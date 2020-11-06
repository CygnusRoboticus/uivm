import { Meta } from "@storybook/react";
import React, { useEffect, useState } from "react";
import { bundleConfig } from "../lib/visitor";
import { Fields as BasicFields } from "./react.basic";
import { CustomConfigs, CustomConfigsTypes } from "./react.configs";
import { Fields as SemanticFields } from "./react.semantic";
import { registry } from "./registry";

function BasicForm() {
  const config = {
    // const config: CustomConfigs = {
    type: "form",
    name: "form",
    fields: [
      {
        type: "message",
        chrome: "info",
        messagers: [{ name: "static", params: { message: "You should enter 'John Wick'" } }],
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
        flags: {
          hidden: [{ name: "field", params: { field: "lastName", value: "Wick" } }],
        },
      },
      { label: "Autofill", type: "text", name: "autofill", disablers: [{ name: "static", params: { value: true } }] },
      { label: "Checkbox", type: "checkbox", name: "checkbox" },
      { type: "button", label: "Click", trigger: { name: "alert", params: { message: "I'm an alert alright" } } },
    ],
    // };
  } as const;

  const [bundle] = useState(() =>
    bundleConfig<typeof config, CustomConfigs, CustomConfigsTypes, typeof registry>(config, registry),
  );
  const [value, setValue] = useState(() => bundle.control.value);
  useEffect(() => {
    bundle.control.patchValue({
      firstName: "John",
      lastName: "Wick",
      movie: "Parabellum",
    });
    bundle.control.value$.subscribe(setValue);
    return () => bundle.control.dispose();
  }, []);

  return (
    <>
      <BasicFields children={[bundle]}></BasicFields>

      <pre>{JSON.stringify(value, null, 2)}</pre>
    </>
  );
}

function SemanticForm() {
  const config = {
    // const config: CustomConfigs = {
    type: "form",
    name: "form",
    fields: [
      {
        type: "message",
        chrome: "info",
        messagers: [{ name: "static", params: { message: "You should enter 'John Wick'" } }],
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
        flags: {
          hidden: [{ name: "field", params: { field: "lastName", value: "Wick" } }],
        },
      },
      { label: "Autofill", type: "text", name: "autofill", disablers: [{ name: "static", params: { value: true } }] },
      { label: "Checkbox", type: "checkbox", name: "checkbox" },
      { type: "button", label: "Click", trigger: { name: "alert", params: { message: "I'm an alert alright" } } },
    ],
    // };
  } as const;

  const [bundle] = useState(() =>
    bundleConfig<typeof config, CustomConfigs, CustomConfigsTypes, typeof registry>(config, registry),
  );
  const [value, setValue] = useState(() => bundle.control.value);
  useEffect(() => {
    bundle.control.patchValue({
      firstName: "John",
      lastName: "Wick",
      movie: "Parabellum",
    });
    bundle.control.value$.subscribe(setValue);
    return () => bundle.control.dispose();
  }, []);

  return (
    <>
      <SemanticFields children={[bundle]}></SemanticFields>

      <pre>{JSON.stringify(value, null, 2)}</pre>
    </>
  );
}

export default {
  title: "Example/React",
  component: BasicForm,
} as Meta;

export const BasicUsage = () => <BasicForm />;
export const SemanticUsage = () => <SemanticForm />;
