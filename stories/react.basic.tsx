import React, { useEffect, useState } from "react";
import { Messages } from "../lib/configs";
import { FieldControl, GroupControl, ItemControl } from "../lib/controls";
import { Executor } from "../lib/executable";
import { ConfigBundle, getRegistryMethod } from "../lib/visitor";
import {
  ButtonConfig,
  CheckboxConfig,
  CustomConfigs,
  FormConfig,
  FormGroupConfig,
  MessageConfig,
  TextConfig,
} from "./react.configs";
import { CustomRegistry } from "./registry";

export const BasicComponentMap = new Map<CustomConfigs["type"], React.ComponentFactory<any, any>>([
  ["form", Form],
  ["text", Text],
  ["message", Message],
  ["button", Button],
  ["checkbox", Checkbox],
  ["formGroup", FormGroup],
]);

export function Fields({
  children,
}: {
  children: ConfigBundle<CustomConfigs, ItemControl, CustomConfigs, CustomRegistry>[];
}) {
  return (
    <>
      {children.map((c, i) => {
        const Component = BasicComponentMap.get(c.config.type);
        if (!Component) {
          throw new Error(`Type "${c.config.type}" not found in component map.`);
        }

        return (
          <div key={i}>
            <Component {...c}></Component>
            <br />
          </div>
        );
      })}
    </>
  );
}

export function Form({
  control,
  config,
  children,
}: ConfigBundle<FormConfig, GroupControl<{}, {}>, CustomConfigs, CustomRegistry>) {
  return (
    <form>
      <Fields children={children}></Fields>
    </form>
  );
}

export function Text({
  config,
  control,
}: ConfigBundle<TextConfig, FieldControl<string | null>, CustomConfigs, CustomRegistry>) {
  const [value, setValue] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState<Messages | null>(null);

  useEffect(() => {
    control.value$.subscribe(setValue);
    control.disabled$.subscribe(setDisabled);
    control.errors$.subscribe(setErrors);
  }, []);

  return (
    <div>
      {config.label}
      <br />
      <input
        placeholder={config.placeholder}
        value={value ?? ""}
        onChange={e => control.setValue(e.currentTarget.value)}
        disabled={disabled}
      />
      <br />
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Checkbox({
  config,
  control,
}: ConfigBundle<CheckboxConfig, FieldControl<boolean>, CustomConfigs, CustomRegistry>) {
  const [value, setValue] = useState<boolean | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState<Messages | null>(null);

  useEffect(() => {
    control.value$.subscribe(setValue);
    control.disabled$.subscribe(setDisabled);
    control.errors$.subscribe(setErrors);
  }, []);

  return (
    <div>
      <input
        type="checkbox"
        checked={value}
        onChange={e => control.setValue(e.currentTarget.checked)}
        disabled={disabled}
      />
      <label>{config.label}</label>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Message({ config, control }: ConfigBundle<MessageConfig, ItemControl, CustomConfigs, CustomRegistry>) {
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

export function FormGroup({
  config,
  control,
  children,
}: ConfigBundle<FormGroupConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  return (
    <>
      <Fields children={children}></Fields>
    </>
  );
}

export function Button({
  config,
  control,
  registry,
}: ConfigBundle<ButtonConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  const [trigger] = useState(() =>
    getRegistryMethod<typeof registry, Executor<ItemControl, void>>(registry, "triggers", config.trigger),
  );
  return (
    <button
      type={config.submit ? "submit" : "button"}
      onClick={() => trigger(config, control, config.trigger.params)(control)}
    >
      {config.label}
    </button>
  );
}
