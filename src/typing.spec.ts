import { BaseArrayConfig, BaseFieldConfig, BaseGroupConfig, BaseItemConfig } from "./primitives";
import { FieldDataType, FieldTypeMap, FormValue } from "./typing";

describe("typings", () => {
  type CustomTypes = FieldTypeMap<
    CustomConfigs,
    { type: "text" | "code" | "radiobutton" },
    { type: "number" | "date" },
    { type: "checkbox" },
    never,
    { type: "text" },
    { type: "text" }
  >;

  type TabConfig = { type: "tab" } & BaseGroupConfig<CustomConfigs>;
  type CustomConfigs =
    | ({ type: "text" } & BaseFieldConfig)
    | ({ type: "code" } & BaseFieldConfig)
    | ({ type: "radiobutton" } & BaseFieldConfig)
    | ({ type: "number" } & BaseFieldConfig)
    | ({ type: "date" } & BaseFieldConfig)
    | ({ type: "checkbox" } & BaseFieldConfig)
    | ({ type: "select" } & BaseFieldConfig)
    | ({ type: "slider" } & BaseFieldConfig)
    | ({ type: "repeatable" } & BaseArrayConfig<CustomConfigs>)
    | ({ type: "group" } & BaseGroupConfig<CustomConfigs> & BaseFieldConfig)
    | ({ type: "divider" } & BaseItemConfig)
    | ({ type: "row" } & BaseGroupConfig<CustomConfigs>)
    | ({ type: "fieldset" } & BaseGroupConfig<CustomConfigs>)
    | TabConfig
    | ({ type: "tabs" } & BaseGroupConfig<TabConfig>);

  test("compiler safety", () => {
    // test types for the monstrosity above
    const testConfig = {
      type: "row",
      fields: [
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
          type: "repeatable",
          fields: {
            type: "row",
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
        },
        { name: "number", type: "number" },
        { name: "numberType", type: "number", dataType: { type: "integer" as unknown as number } },
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
      ],
    } as const;

    const testValue: FormValue<typeof testConfig, CustomConfigs, CustomTypes> = {
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

    const {
      checkbox,
      code,
      date,
      rowText,
      fieldsetText,
      fieldsetSelect,
      fieldsetFieldsetText,
      group: {
        groupText,
        groupGroup: { groupGroupNumber, groupGroupRowCheckbox },
      },
      repeatable: [],
      // {
      //   repeatableText: "",
      //   repeatableNumber: 0,
      //   repeatableFieldsetGroup: { repeatableFieldsetGroupText: "" },
      // },
      number,
      numberType,
      radiobutton,
      select,
      slider,
      tabsTabsText,
      text,
    } = testValue;
  });
});
