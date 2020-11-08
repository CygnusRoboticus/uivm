import { Meta, Story } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { bundleConfig } from "../lib/visitor";
import { Fields as BasicFields } from "./react.basic";
import { CustomConfigs, CustomConfigsTypes } from "./react.configs";
import { Fields as SemanticFields } from "./react.semantic";
import { registry } from "./registry";

function ReactForm({ FieldsComponent }: { FieldsComponent: React.ComponentFactory<any, any> }) {
  const config = {
    // const config: CustomConfigs = {
    type: "form",
    name: "form",
    fields: [
      {
        type: "message",
        messagers: [{ name: "static", params: { message: "You should enter 'John Wick'" } }],
        hints: {
          error: [{ name: "field", params: { field: "firstName", value: "John" } }],
        },
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
    // };
    // const a = {
    //   a: 1,
  } as const;

  const [bundle] = useState(() =>
    bundleConfig<typeof config, CustomConfigs, CustomConfigsTypes, typeof registry>(config, registry, {
      firstName: "John",
      lastName: "Wick",
      movie: "Parabellum",
      autofill: "",
      checkbox: false,
      select: 2,
    }),
  );
  const [state, setState] = useState(() => bundle.control.state);
  useEffect(() => {
    bundle.control.state$.subscribe(setState);
    return () => bundle.control.dispose();
  }, []);

  return (
    <>
      <FieldsComponent children={[bundle]}></FieldsComponent>

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
BasicUsage.args = { FieldsComponent: BasicFields };
export const SemanticUsage = Template.bind({});
SemanticUsage.args = { FieldsComponent: SemanticFields };
