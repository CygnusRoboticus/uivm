import { Meta, Story } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { ComponentBuilder } from "../src/component";
import { GroupControl } from "../src/controls";
import { FormValue } from "../src/typing";
import { ControlVisitor, createConfigBuilder } from "../src/visitor";
import { BasicBuilder } from "./react.basic";
import { CustomConfigs, CustomConfigsTypes } from "./react.configs";
import { SemanticBuilder } from "./react.semantic";
import { registry } from "./registry";

const visitor = new ControlVisitor<CustomConfigs, typeof registry>();
const controlBuilder = createConfigBuilder<CustomConfigs, typeof registry, typeof visitor>(registry, visitor);

function ReactForm({ builder }: { builder: ComponentBuilder<any, any, any, any, any, any> }) {
  const config = {
    type: "form",
    name: "form",
    fields: [
      {
        type: "message",
        messagers: [{ name: "static", params: { message: "You should enter 'John Wick'" } }],
        extras: {
          chrome: { name: "static", params: { value: "info" } },
        },
      },
      {
        type: "formGroup",
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
        label: "Movie",
        type: "text",
        name: "movie",
        hints: {
          hidden: [{ name: "field", params: { field: "lastName", value: "Wick" } }],
        },
      },
      { label: "Autofill", type: "text", name: "autofill", disablers: [{ name: "static", params: { value: true } }] },
      {
        label: "Select",
        type: "select",
        name: "select",
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

  const [bundle] = useState(() => {
    const b = controlBuilder<GroupControl<FormValue<typeof config["fields"], CustomConfigs, CustomConfigsTypes>>>(
      config,
    );
    b.control.reset({
      firstName: "John",
      lastName: "Wick",
      movie: "Parabellum",
      autofill: "",
      checkbox: false,
      select: 2,
    });
    return b;
  });
  const [state, setState] = useState(() => bundle.control.state);
  useEffect(() => {
    bundle.control.state$.subscribe(setState);
    return () => bundle.control.dispose();
  }, []);

  return (
    <>
      {builder(bundle)}

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
