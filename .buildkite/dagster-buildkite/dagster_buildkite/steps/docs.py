from typing import List

from dagster_buildkite.steps.tox import build_tox_step

from ..python_version import AvailablePythonVersion
from ..step_builder import CommandStepBuilder
from ..utils import BuildkiteLeafStep, GroupStep


def build_docs_steps() -> List[GroupStep]:

    steps: List[BuildkiteLeafStep] = [
        # Make sure snippets in built docs match source.
        # If this test is failing, it's because you may have either:
        #   (1) Updated the code that is referenced by a literal include in the documentation
        #   (2) Directly modified the inline snapshot of a literalinclude instead of updating
        #       the underlying code that the literalinclude is pointing to.
        # To fix this, run 'make snapshot' in the /docs directory to update the snapshots.
        # Be sure to check the diff to make sure the literalincludes are as you expect them."
        CommandStepBuilder("docs code snapshots")
        .run("pushd docs; make docs_dev_install; make snapshot", "git diff --exit-code")
        .on_integration_image(AvailablePythonVersion.V3_7)
        .build(),
        # Make sure the docs site can build end-to-end.
        CommandStepBuilder("docs next")
        .run(
            "pushd docs/next",
            "yarn",
            "yarn test",
            "yarn build-master",
        )
        .on_integration_image(AvailablePythonVersion.V3_7)
        .build(),
        # Make sure docs sphinx build runs.
        CommandStepBuilder("docs sphinx json build")
        .run(
            "pip install -U virtualenv",
            "cd docs",
            "tox -vv -e py38-sphinx",
        )
        .on_integration_image(AvailablePythonVersion.V3_8)
        .build(),
        # Verify screenshot integrity.
        CommandStepBuilder("docs screenshot spec")
        .run("python docs/screenshot_capture/match_screenshots.py")
        .on_integration_image(AvailablePythonVersion.V3_8)
        .build(),
        # mypy for build scripts
        build_tox_step("docs", "mypy", command_type="mypy"),
        # pylint for build scripts
        build_tox_step("docs", "pylint", command_type="pylint"),
    ]
    return [
        GroupStep(
            group=":book: docs",
            key="docs",
            steps=steps,
        )
    ]
