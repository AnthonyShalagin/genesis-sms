#!/usr/bin/env python3
"""Generate a signed iOS Shortcut for Genesis GV70 remote commands."""

import plistlib
import subprocess
import sys
import os
import uuid

API_URL_PLACEHOLDER = "https://genesis-sms.vercel.app/api/command"
API_KEY = "a0e11bfb4297c76bacee845ac51e878d471733531dcad30c42f258e09ba61554"
PIN = "1249"

COMMANDS = ["start", "stop", "lock", "unlock", "status"]

# UUIDs for linking action outputs
URL_ACTION_UUID = str(uuid.uuid4()).upper()
DICT_VALUE_UUID = str(uuid.uuid4()).upper()


def make_text_token(value):
    return {
        "Value": {"string": value},
        "WFSerializationType": "WFTextTokenString",
    }


def make_dict_field(key, value, item_type=0):
    return {
        "WFItemType": item_type,
        "WFKey": make_text_token(key),
        "WFValue": make_text_token(value),
    }


def make_dictionary_value(items):
    return {
        "Value": {"WFDictionaryFieldValueItems": items},
        "WFSerializationType": "WFDictionaryFieldValue",
    }


def make_output_ref(output_uuid, output_name):
    return {
        "Value": {
            "attachmentsByRange": {
                "{0, 1}": {
                    "OutputName": output_name,
                    "OutputUUID": output_uuid,
                    "Type": "ActionOutput",
                }
            },
            "string": "\ufffc",
        },
        "WFSerializationType": "WFTextTokenString",
    }


def build_menu_shortcut(api_url, api_key, pin):
    """Build a shortcut with a menu for all commands."""

    menu_uuid = str(uuid.uuid4()).upper()
    url_uuids = {cmd: str(uuid.uuid4()).upper() for cmd in COMMANDS}
    dict_uuids = {cmd: str(uuid.uuid4()).upper() for cmd in COMMANDS}

    actions = []

    # Menu start
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": menu_uuid,
                "WFControlFlowMode": 0,  # Menu start
                "WFMenuPrompt": "GV70 Command",
                "WFMenuItems": COMMANDS,
            },
        }
    )

    # Each menu item
    for cmd in COMMANDS:
        # Menu item header
        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
                "WFWorkflowActionParameters": {
                    "GroupingIdentifier": menu_uuid,
                    "WFControlFlowMode": 1,  # Menu item
                    "WFMenuItemTitle": cmd,
                },
            }
        )

        # POST request for this command
        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
                "WFWorkflowActionParameters": {
                    "UUID": url_uuids[cmd],
                    "WFURL": api_url,
                    "WFHTTPMethod": "POST",
                    "WFHTTPBodyType": "JSON",
                    "WFHTTPHeaders": make_dictionary_value(
                        [make_dict_field("x-api-key", api_key)]
                    ),
                    "WFJSONValues": make_dictionary_value(
                        [
                            make_dict_field("command", cmd),
                            make_dict_field("pin", pin),
                        ]
                    ),
                },
            }
        )

        # Get "message" from JSON response
        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
                "WFWorkflowActionParameters": {
                    "UUID": dict_uuids[cmd],
                    "WFInput": make_output_ref(url_uuids[cmd], "Contents of URL"),
                    "WFDictionaryKey": "message",
                },
            }
        )

        # Show notification
        actions.append(
            {
                "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
                "WFWorkflowActionParameters": {
                    "WFNotificationActionTitle": f"GV70 {cmd.title()}",
                    "WFNotificationActionBody": make_output_ref(
                        dict_uuids[cmd], "Dictionary Value"
                    ),
                },
            }
        )

    # Menu end
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.choosefrommenu",
            "WFWorkflowActionParameters": {
                "GroupingIdentifier": menu_uuid,
                "WFControlFlowMode": 2,  # Menu end
            },
        }
    )

    return {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": 59511,  # Car icon
            "WFWorkflowIconStartColor": 463140863,  # Dark blue
        },
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowActions": actions,
        "WFWorkflowTypes": [],
    }


def build_single_shortcut(api_url, api_key, pin, command):
    """Build a shortcut for a single command."""

    actions = []

    # POST request
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
            "WFWorkflowActionParameters": {
                "UUID": URL_ACTION_UUID,
                "WFURL": api_url,
                "WFHTTPMethod": "POST",
                "WFHTTPBodyType": "JSON",
                "WFHTTPHeaders": make_dictionary_value(
                    [make_dict_field("x-api-key", api_key)]
                ),
                "WFJSONValues": make_dictionary_value(
                    [
                        make_dict_field("command", command),
                        make_dict_field("pin", pin),
                    ]
                ),
            },
        }
    )

    # Get "message" from JSON response
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.getvalueforkey",
            "WFWorkflowActionParameters": {
                "UUID": DICT_VALUE_UUID,
                "WFInput": make_output_ref(URL_ACTION_UUID, "Contents of URL"),
                "WFDictionaryKey": "message",
            },
        }
    )

    # Show notification
    actions.append(
        {
            "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
            "WFWorkflowActionParameters": {
                "WFNotificationActionTitle": f"GV70 {command.title()}",
                "WFNotificationActionBody": make_output_ref(
                    DICT_VALUE_UUID, "Dictionary Value"
                ),
            },
        }
    )

    return {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowMinimumClientVersionString": "900",
        "WFWorkflowClientVersion": "2700.0.4",
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": 59511,
            "WFWorkflowIconStartColor": 463140863,
        },
        "WFWorkflowInputContentItemClasses": [],
        "WFWorkflowActions": actions,
        "WFWorkflowTypes": [],
    }


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "shortcuts")
    os.makedirs(out_dir, exist_ok=True)

    # Generate the all-in-one menu shortcut
    print("Generating GV70 Control (menu shortcut)...")
    plist = build_menu_shortcut(API_URL_PLACEHOLDER, API_KEY, PIN)
    unsigned = os.path.join(out_dir, "GV70-Control-unsigned.shortcut")
    signed = os.path.join(out_dir, "GV70-Control.shortcut")
    with open(unsigned, "wb") as f:
        plistlib.dump(plist, f, fmt=plistlib.FMT_BINARY)

    result = subprocess.run(
        ["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", signed],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        os.remove(unsigned)
        print(f"  ✓ Signed: {signed}")
    else:
        print(f"  ⚠ Signing failed: {result.stderr}")
        print(f"  Unsigned file saved: {unsigned}")

    # Generate individual command shortcuts
    for cmd in COMMANDS:
        print(f"Generating GV70 {cmd.title()} shortcut...")
        plist = build_single_shortcut(API_URL_PLACEHOLDER, API_KEY, PIN, cmd)
        name = f"GV70-{cmd.title()}"
        unsigned = os.path.join(out_dir, f"{name}-unsigned.shortcut")
        signed = os.path.join(out_dir, f"{name}.shortcut")
        with open(unsigned, "wb") as f:
            plistlib.dump(plist, f, fmt=plistlib.FMT_BINARY)

        result = subprocess.run(
            ["shortcuts", "sign", "--mode", "anyone", "--input", unsigned, "--output", signed],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            os.remove(unsigned)
            print(f"  ✓ Signed: {signed}")
        else:
            print(f"  ⚠ Signing failed: {result.stderr}")
            print(f"  Unsigned file saved: {unsigned}")

    print(f"\nAll shortcuts saved to: {out_dir}")
    print("AirDrop or iCloud Drive them to your iPhone!")


if __name__ == "__main__":
    main()
