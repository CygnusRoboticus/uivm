// also exported from '@storybook/react' if you can deal with breaking changes in 6.1
import { Meta, Story } from "@storybook/react/types-6-0";
import React, { useEffect, useState } from "react";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import { AbstractFlags, FieldConfig, GroupConfig, ItemConfig, Messages } from "../lib/configs";
import { FieldControl, GroupControl, ItemControl } from "../lib/controls";
import { ExecutableDefinition } from "../lib/executable";
import { BaseItemConfig } from "../lib/primitives";
import { FieldTypeMap } from "../lib/typing";
import { bundleConfig, ConfigBundle } from "../lib/visitor";

const registry = {
  messagers: {
    static(config: ItemConfig<any, any>, { message }: { message: string }, control: ItemControl<any>) {
      return () => of({ static: { message } });
    },
  },
  triggers: {
    autofill(
      config: BaseItemConfig,
      { field, pattern, replace }: { field: string; pattern?: RegExp | string; replace?: string },
      control: FieldControl<any, any>,
    ) {
      const regex = pattern && replace ? (typeof pattern === "string" ? new RegExp(pattern) : pattern) : undefined;
      return () =>
        control.value$.pipe(
          tap(() => {
            const dependent = control.root.get(field);
            console.log({ field, pattern, replace, dependent });
            if (dependent) {
              const value = typeof control.value === "string" ? control.value : "";
              dependent.setValue(regex && replace ? value.replace(regex, replace) : value);
            }
          }),
        );
    },
  },
  flags: {
    static(config: any, { value }: { value: boolean }, control: any) {
      return () => of(value);
    },
    pants: {} as any,
  },
  validators: {},
  search: {},
};

type CustomRegistry = typeof registry;

interface FormConfig
  extends GroupConfig<CustomConfigs, CustomRegistry, AbstractFlags>,
    FieldConfig<CustomRegistry, AbstractFlags> {
  type: "form";
}

interface TextConfig extends FieldConfig<CustomRegistry, AbstractFlags> {
  type: "text";
  label?: string;
  placeholder?: string;
}

interface ButtonConfig extends ItemConfig<CustomRegistry, AbstractFlags> {
  type: "button";
  label: string;
  submit?: boolean;
  clickTrigger?: ExecutableDefinition<CustomRegistry["triggers"], Observable<void>>[];
}

interface MessageConfig extends ItemConfig<CustomRegistry, AbstractFlags> {
  type: "message";
  title?: string;
  message?: string;
}

type CustomConfigs = FormConfig | TextConfig | ButtonConfig | MessageConfig;

type CustomConfigsTypes = FieldTypeMap<CustomConfigs, { type: "text" }, never, never, never, never>;

const ComponentMap = new Map<CustomConfigs["type"], React.ComponentFactory<any, any>>([
  ["form", Form],
  ["text", Text],
  ["message", Message],
  ["button", Button],
]);

function TypedForm() {
  const config = {
    type: "form",
    name: "form",
    fields: [
      {
        label: "First Name",
        type: "text",
        name: "firstName",
        triggers: [{ name: "autofill", params: { field: "autofill", pattern: "^(.*)", replace: "$1 - autofill" } }],
      },
      { label: "Last Name", type: "text", name: "lastName" },
      { label: "Autofill", type: "text", name: "autofill", disablers: [{ name: "static", params: { value: true } }] },
      { type: "message", messagers: [{ name: "static", params: { message: "Simple messager implementation." } }] },
      { type: "button", label: "Click" },
    ],
  } as const;

  const [bundle] = useState(
    bundleConfig<typeof config, CustomConfigs, CustomConfigsTypes, CustomRegistry>(config, registry),
  );
  const [value, setValue] = useState(bundle.control.value);
  useEffect(() => {
    bundle.control.setValue({
      firstName: "John",
      lastName: "Wick",
      autofill: "",
    });
    bundle.control.value$.subscribe(setValue);
    return () => bundle.control.dispose();
  }, []);

  return (
    <>
      <Fields {...bundle}></Fields>

      <pre>{JSON.stringify(value, null, 2)}</pre>
    </>
  );
}

function Fields({ control, config, children }: ConfigBundle<ItemControl, CustomConfigs, CustomRegistry>) {
  return (
    <>
      {children.map((c, i) => {
        const Component = ComponentMap.get(c.config.type);
        return <Component key={i} {...c}></Component>;
      })}
    </>
  );
}

function Form(props: ConfigBundle<GroupControl<{}, {}>, CustomConfigs, CustomRegistry>) {
  return (
    <form>
      <Fields {...props}></Fields>
    </form>
  );
}

function Text({ config, control }: ConfigBundle<FieldControl<string | null>, TextConfig, CustomRegistry>) {
  const [value, setValue] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);

  useEffect(() => {
    control.value$.subscribe(setValue);
    control.disabled$.subscribe(setDisabled);
  }, []);

  return (
    <>
      {config.label}
      <input
        placeholder={config.placeholder}
        value={value ?? ""}
        onChange={e => control.setValue(e.currentTarget.value)}
        disabled={disabled}
      />
    </>
  );
}

function Message({ config, control }: ConfigBundle<ItemControl, MessageConfig, CustomRegistry>) {
  const [messages, setMessage] = useState<Messages | null>();
  useEffect(() => {
    control.messages$.subscribe(setMessage);
  }, []);

  return (
    <>
      <fieldset>
        {Object.values(messages ?? {}).map((m, i) => (
          <span key={i}>
            {m.message}
            <br />
          </span>
        ))}
      </fieldset>
    </>
  );
}

function Button({ config, control }: ConfigBundle<ItemControl, ButtonConfig, CustomRegistry>) {
  return <button type={config.submit ? "submit" : "button"}>{config.label}</button>;
}

export default {
  title: "Example/React",
  component: TypedForm,
} as Meta;

const Template: Story<{}> = args => <TypedForm {...args} />;
export const BasicUsage = Template.bind({});
BasicUsage.args = {};
