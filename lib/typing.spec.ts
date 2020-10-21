import { FormInfoBase } from "./configs";
import { ArrayControl, FieldControl, GroupControl } from "./controls";
import { AnyConfig } from "./primitives";
import { FieldDataType, FieldTypeMap, FormControl } from "./typing";

describe("typings", () => {
  test("compiler safety", () => {
    // test types for the monstrosity above
    const testConfig = [
      { name: "checkbox", type: "checkbox" },
      { name: "code", type: "code" },
      { name: "date", type: "date" },
      { type: "row", fields: [{ name: "rowText", type: "text" }] },
      {
        type: "fieldset",
        fields: [
          { name: "fieldsetText", type: "text" },
          { name: "fieldsetSelect", type: "select", dataType: { type: FieldDataType.StringType } },
          {
            type: "fieldset",
            fields: [{ name: "fieldsetFieldsetText", type: "text" }],
          },
        ],
      },
      {
        name: "group",
        type: "group",
        fields: [
          { name: "groupText", type: "text" },
          {
            name: "groupGroup",
            type: "group",
            fields: [
              { name: "groupGroupNumber", type: "number" },
              {
                type: "row",
                fields: [{ name: "groupGroupRowCheckbox", type: "checkbox" }],
              },
            ],
          },
        ],
      },
      { type: "divider" },
      {
        name: "repeatable",
        type: "group",
        array: true,
        fields: [
          { name: "repeatableText", type: "text" },
          { name: "repeatableNumber", type: "number" },
          {
            type: "fieldset",
            fields: [
              { type: "divider" },
              {
                name: "repeatableFieldsetGroup",
                type: "group",
                fields: [{ name: "repeatableFieldsetGroupText", type: "text" }],
              },
            ],
          },
        ],
      },
      { name: "number", type: "number" },
      { name: "numberType", type: "number", dataType: { type: ("integer" as unknown) as number } },
      { name: "radiobutton", type: "radiobutton", dataType: { type: FieldDataType.StringType } },
      { name: "select", type: "select", dataType: { type: FieldDataType.StringType, array: true } },
      { name: "slider", type: "slider", dataType: { type: [0, 1] as number[] } },
      {
        type: "tabs",
        fields: [
          { type: "tab", fields: [{ name: "tabsTabsText", type: "text" }] },
          { type: "tab", fields: [] },
        ],
      },
      { name: "text", type: "text" },
    ] as const;

    // for testing purposes
    interface DynaFieldTypeMap extends FieldTypeMap<AnyConfig> {
      string: { type: "text" | "code" | "radiobutton" };
      number: { type: "number" | "date" };
      boolean: { type: "checkbox" };
      array: never;
      null: { type: "text" };
    }

    interface FormInfo extends FormInfoBase {
      types: DynaFieldTypeMap;
    }

    const testControl: FormControl<typeof testConfig, FormInfo> = new GroupControl({
      checkbox: new FieldControl<boolean>(true),
      code: new FieldControl<string>(""),
      date: new FieldControl<number>(0),
      rowText: new FieldControl<string | null>(""),
      fieldsetText: new FieldControl<string | null>(""),
      fieldsetSelect: new FieldControl<string>(""),
      fieldsetFieldsetText: new FieldControl<string | null>(""),
      group: new GroupControl({
        groupText: new FieldControl(<string | null>""),
        groupGroup: new GroupControl({
          groupGroupNumber: new FieldControl<number>(0),
          groupGroupRowCheckbox: new FieldControl<boolean>(true),
        }),
      }),
      repeatable: new ArrayControl(
        (
          v: {
            repeatableText: string | null;
            repeatableNumber: number;
            repeatableFieldsetGroup: { repeatableFieldsetGroupText: string | null };
          } | null,
        ) =>
          new GroupControl({
            repeatableText: new FieldControl(v?.repeatableText ?? null),
            repeatableNumber: new FieldControl(v?.repeatableNumber ?? 0),
            repeatableFieldsetGroup: new GroupControl({
              repeatableFieldsetGroupText: new FieldControl(
                v?.repeatableFieldsetGroup.repeatableFieldsetGroupText ?? null,
              ),
            }),
          }),
      ),
      number: new FieldControl<number>(0),
      numberType: new FieldControl<number>(0),
      radiobutton: new FieldControl<string>(""),
      select: new FieldControl<string[]>([]),
      slider: new FieldControl<number[]>([]),
      tabsTabsText: new FieldControl(<string | null>""),
      text: new FieldControl<string | null>(null),
    });

    const testValue: typeof testControl["value"] = {
      checkbox: true,
      code: "",
      date: 0,
      rowText: "",
      fieldsetText: null,
      fieldsetSelect: "",
      fieldsetFieldsetText: "",
      group: {
        groupText: "",
        groupGroup: {
          groupGroupNumber: 0,
          groupGroupRowCheckbox: true,
        },
      },
      repeatable: [
        {
          repeatableText: "",
          repeatableNumber: 0,
          repeatableFieldsetGroup: { repeatableFieldsetGroupText: "" },
        },
      ],
      number: 0,
      numberType: 0,
      radiobutton: "",
      select: ["", "", "", ""],
      slider: [0, 1, 2, 3],
      tabsTabsText: "",
      text: "",
    };

    testControl.setValue(testValue);
    expect(testControl.value).toEqual(testValue);
  });
});
