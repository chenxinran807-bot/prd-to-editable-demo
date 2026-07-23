import pathlib
import struct
import sys
import tempfile
import unittest


ROOT = pathlib.Path(__file__).parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from prototype_pipeline import (  # noqa: E402
    PipelineValidationError,
    confirm_flow_node,
    decide_qa_action,
    validate_delivery,
    validate_flow,
    validate_qa_report,
    validate_visual_option_files,
    validate_visual_options,
    visual_strategy,
)


class PrototypePipelineTest(unittest.TestCase):
    def png(self, path, width, height):
        path.write_bytes(
            b"\x89PNG\r\n\x1a\n"
            + struct.pack(">I", 13)
            + b"IHDR"
            + struct.pack(">II", width, height)
            + b"\x08\x06\x00\x00\x00"
        )

    def test_explicit_reference_skips_forced_exploration(self):
        self.assertEqual("reference-led", visual_strategy(True, False))
        self.assertEqual("explore", visual_strategy(False, False))
        self.assertEqual("explore", visual_strategy(True, True))

    def test_visual_exploration_requires_three_unique_equal_viewports(self):
        options = [
            {"id": key, "artifact": f"visual-{key}.png", "width": 390, "height": 844}
            for key in ("A", "B", "C")
        ]
        self.assertEqual(options, validate_visual_options(options, 390, 844))
        with self.assertRaisesRegex(PipelineValidationError, "恰好 3 个"):
            validate_visual_options(options[:2], 390, 844)
        options[2]["height"] = 800
        with self.assertRaisesRegex(PipelineValidationError, "视口"):
            validate_visual_options(options, 390, 844)

    def test_visual_file_gate_reads_real_png_dimensions_not_declared_metadata(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = pathlib.Path(temporary)
            for key in ("A", "B", "C"):
                self.png(root / f"{key}.png", 390, 844)
            options = [
                {"id": key, "artifact": f"{key}.png", "width": 390, "height": 844}
                for key in ("A", "B", "C")
            ]
            self.assertEqual(options, validate_visual_option_files(options, root, 390, 844))
            self.png(root / "A.png", 400, 256)
            with self.assertRaisesRegex(PipelineValidationError, "真实尺寸"):
                validate_visual_option_files(options, root, 390, 844)

    def test_flow_embeds_visual_bindings_and_requires_every_node_confirmed(self):
        flow = {
            "schemaVersion": "1.0",
            "presentation": {
                "type": "visual-flow",
                "artifact": "flow/flow.html",
                "layout": "left-to-right",
            },
            "nodes": [
                {
                    "id": "home",
                    "title": "首页",
                    "thumbnail": "flow/home.png",
                    "confirmation": "confirmed",
                    "visualBindings": [
                        {"target": "page-shell", "reference": "home.png"}
                    ],
                }
            ],
            "edges": [],
            "confirmationEvents": [
                {"nodeId": "home", "userMessageId": "message-1"}
            ],
        }
        self.assertEqual(flow, validate_flow(flow))
        flow["nodes"][0]["confirmation"] = "pending"
        with self.assertRaisesRegex(PipelineValidationError, "尚未确认"):
            validate_flow(flow)

    def test_flow_requires_a_visual_artifact_not_only_a_table(self):
        flow = {
            "schemaVersion": "1.0",
            "nodes": [{
                "id": "home",
                "title": "首页",
                "thumbnail": "flow/home.png",
                "confirmation": "confirmed",
                "visualBindings": [{"target": "page-shell", "reference": "home.png"}],
            }],
            "edges": [],
            "confirmationEvents": [{"nodeId": "home", "userMessageId": "message-1"}],
        }
        with self.assertRaisesRegex(PipelineValidationError, "可视化动线产物"):
            validate_flow(flow)

    def test_confirm_flow_node_accepts_only_one_new_node_per_user_message(self):
        flow = {
            "schemaVersion": "1.0",
            "presentation": {
                "type": "visual-flow",
                "artifact": "flow/flow.html",
                "layout": "left-to-right",
            },
            "nodes": [
                {"id": key, "title": key, "thumbnail": f"flow/{key}.png",
                 "confirmation": "pending", "visualBindings": [{"target": key}]}
                for key in ("home", "settings")
            ],
            "edges": [],
            "confirmationEvents": [],
        }
        confirm_flow_node(flow, "home", "message-1")
        self.assertEqual("confirmed", flow["nodes"][0]["confirmation"])
        self.assertEqual("pending", flow["nodes"][1]["confirmation"])
        with self.assertRaisesRegex(PipelineValidationError, "一条用户消息只能确认一个节点"):
            confirm_flow_node(flow, "settings", "message-1")

    def test_qa_batches_fixes_and_blocks_unresolved_p0_p1_after_three_rounds(self):
        p1 = {
            "target": "top-navigation",
            "reference": "home.png",
            "layer": "visual-fidelity",
            "severity": "P1",
            "issue": "高度偏大",
            "expected": "44px",
            "actual": "56px",
            "action": "reduce height",
        }
        self.assertEqual("fix-batch", decide_qa_action([p1], round_number=1))
        self.assertEqual("blocked", decide_qa_action([p1], round_number=3))
        p3 = dict(p1, severity="P3")
        self.assertEqual("pass-with-notes", decide_qa_action([p3], round_number=1))
        self.assertEqual("pass", decide_qa_action([], round_number=1))

    def test_qa_rejects_unstructured_or_unknown_layer_findings(self):
        with self.assertRaisesRegex(PipelineValidationError, "缺少字段"):
            decide_qa_action([{"severity": "P1"}], round_number=1)
        finding = {
            "target": "save",
            "reference": "PRD-7",
            "layer": "looks-good",
            "severity": "P1",
            "issue": "unknown",
            "expected": "works",
            "actual": "fails",
            "action": "fix",
        }
        with self.assertRaisesRegex(PipelineValidationError, "QA 层"):
            decide_qa_action([finding], round_number=1)

    def test_qa_stops_early_when_the_same_blocker_repeats(self):
        finding = {
            "target": "top-navigation",
            "reference": "home.png",
            "layer": "visual-fidelity",
            "severity": "P1",
            "issue": "高度偏大",
            "expected": "44px",
            "actual": "56px",
            "action": "reduce height",
        }
        signature = "visual-fidelity|P1|top-navigation|高度偏大"
        self.assertEqual(
            "blocked",
            decide_qa_action([finding], round_number=2, previous_signatures={signature}),
        )

    def test_delivery_rejects_placeholder_or_missing_flow_link(self):
        with self.assertRaisesRegex(PipelineValidationError, "真实可打开"):
            validate_delivery({
                "prototypeUrl": "https://example.com/prototype.html",
                "flowUrl": "#",
            })
        with self.assertRaisesRegex(PipelineValidationError, "真实可打开"):
            validate_delivery({
                "prototypeUrl": "https://example.com/prototype.html",
            })
        delivery = {
            "prototypeUrl": "https://example.com/prototype.html",
            "flowUrl": "https://example.com/flow.html",
        }
        self.assertEqual(delivery, validate_delivery(delivery))

    def test_qa_requires_real_rendered_visual_comparison_evidence(self):
        report = {
            "schemaVersion": "1.0",
            "environment": {
                "viewport": {"width": 390, "height": 844},
                "page": "home",
                "state": "default",
                "scroll": {"x": 0, "y": 0},
                "fontsReady": True,
                "imagesReady": True,
                "animationsPaused": True,
                "editorHidden": True,
            },
            "comparisons": [{
                "target": "home-shell",
                "reference": "visual-options/A.png",
                "actualScreenshot": "qa/evidence/home.png",
                "method": "rendered-screenshot",
            }],
            "findings": [],
        }
        self.assertEqual(report, validate_qa_report(report))
        report["comparisons"][0]["actualScreenshot"] = ""
        with self.assertRaisesRegex(PipelineValidationError, "实现截图"):
            validate_qa_report(report)
        report["comparisons"][0]["actualScreenshot"] = "qa/evidence/home.png"
        report["environment"]["editorHidden"] = False
        with self.assertRaisesRegex(PipelineValidationError, "html-editor"):
            validate_qa_report(report)


if __name__ == "__main__":
    unittest.main()
