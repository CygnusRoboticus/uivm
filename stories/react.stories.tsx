import { Meta, Story } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { ComponentBuilder } from "../src/component";
import { GroupControl } from "../src/controls";
import { FormValue } from "../src/typing";
import { BasicVisitor, createConfigBuilder } from "../src/visitor";
import { BasicBuilder } from "./react.basic";
import { CustomConfigs, CustomConfigsTypes, CustomExtras, CustomHints, CustomRegistry } from "./react.configs";
import { SemanticBuilder } from "./react.semantic";

const registry = new CustomRegistry();
const visitor = new BasicVisitor<CustomConfigs, CustomRegistry, CustomHints, CustomExtras>();
const controlBuilder = createConfigBuilder<CustomConfigs, CustomRegistry, typeof visitor>(registry, visitor);

function ReactForm({ builder }: { builder: ComponentBuilder<any, any, any, any, any> }) {
  const config = {
    type: "form",
    name: "form",
    fields: [
      {
        type: "message",
        messagers: [
          { name: "demoMessage", params: {} },
          { name: "static", params: { message: "You should enter 'John Wick'" } },
        ],
        extras: {
          chrome: { name: "static", params: { value: "info" } },
        },
      },
      {
        type: "container",
        fields: [
          {
            label: "First Name",
            type: "text",
            name: "firstName",
            triggers: [{ name: "autofill", params: { field: "autofill", pattern: "^(.*)", replace: "$1 - autofill" } }],
            validators: [{ name: "required", params: {} }],
          },
          { label: "Last Name", type: "text", name: "lastName", validators: [{ name: "required", params: {} }] },
        ],
      },
      {
        label: "Hidden Field",
        type: "text",
        name: "hiddenField",
        hints: {
          hidden: [{ name: "field", params: { field: "lastName", value: "Wick" } }],
        },
      },
      {
        label: "Films",
        type: "repeater",
        name: "films",
        fields: {
          type: "container",
          fields: [{ type: "text", name: "film" }],
        },
      },
      { label: "Autofill", type: "text", name: "autofill", disablers: [{ name: "static", params: { value: true } }] },
      {
        label: "Select",
        type: "select",
        name: "select",
        dataType: { type: "number" },
        options: [
          {
            name: "static",
            params: {
              options: [
                { label: "One", value: 1 },
                { label: "Two", value: 2 },
                { label: "Three", value: 3 },
              ],
            },
          },
        ],
      },
      { label: "Checkbox", type: "checkbox", name: "checkbox" },
      { type: "button", label: "Click", trigger: { name: "alert", params: { message: "I'm an alert alright" } } },
    ],
  } as const;

  const [control] = useState(() => {
    const c = controlBuilder<typeof config, GroupControl<FormValue<typeof config, CustomConfigs, CustomConfigsTypes>, CustomHints, CustomExtras>>(
      config,
    );
    c.reset({
      firstName: "John",
      lastName: "Wick",
      hiddenField: "Hidden when Wick",
      films: [{ film: "John Wick" }, { film: "Takes Manhatten" }, { film: "Parabellum" }],
      autofill: null,
      checkbox: false,
      select: 2
    });
    return c;
  });
  const [state, setState] = useState(() => control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
    return () => control.dispose();
  }, []);

  return (
    <>
      {builder(control)}

      <pre>{JSON.stringify(state, null, 2)}</pre>
    </>
  );
}

export default {
  title: "Example/React",
  component: ReactForm,
} as Meta;

const Template: Story<Parameters<typeof ReactForm>[0]> = args => <ReactForm {...args} />;
export const BasicUsage = Template.bind({});
BasicUsage.args = { builder: BasicBuilder };
export const SemanticUsage = Template.bind({});
SemanticUsage.args = { builder: SemanticBuilder };
