import React, { useEffect, useState } from "react";
import "semantic-ui-css/semantic.min.css";
import { Button as SemanticButton, Form as SemanticForm, Input, Message as SemanticMessage } from "semantic-ui-react";
import { FieldControl, GroupControl, ItemControl } from "../lib/controls";
import { AbstractHints, Trigger } from "../lib/controls.types";
import { Executable } from "../lib/executable";
import { ConfigBundle, getRegistryMethod, getRegistryValue } from "../lib/visitor";
import {
  ButtonConfig,
  CheckboxConfig,
  CustomConfigs,
  FormConfig,
  FormGroupConfig,
  MessageConfig,
  SelectConfig,
  TextConfig,
} from "./react.configs";
import { CustomRegistry } from "./registry";

export const SemanticComponentMap = new Map<CustomConfigs["type"], React.ComponentFactory<any, any>>([
  ["form", Form],
  ["text", Text],
  ["message", Message],
  ["button", Button],
  ["checkbox", Checkbox],
  ["select", Select],
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
        const Component = SemanticComponentMap.get(c.config.type);
        if (!Component) {
          throw new Error(`Type "${c.config.type}" not found in component map.`);
        }

        return <Component key={i} {...c}></Component>;
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
    <SemanticForm>
      <Fields children={children}></Fields>
    </SemanticForm>
  );
}

export function Text({
  config,
  control,
}: ConfigBundle<TextConfig, FieldControl<string | null>, CustomConfigs, CustomRegistry>) {
  const [{ hints, value, disabled, errors }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return hints.hidden ? null : (
    <SemanticForm.Field
      // id=""
      required={config.validators?.some(v => v.name === "required")}
      control={Input}
      label={config.label}
      placeholder={config.placeholder}
      value={value ?? ""}
      onChange={e => control.setValue(e.currentTarget.value)}
      disabled={disabled}
      error={
        errors
          ? {
              content: Object.values(errors)[0].message,
            }
          : errors
      }
    />
  );
}

export function Checkbox({
  config,
  control,
}: ConfigBundle<CheckboxConfig, FieldControl<boolean>, CustomConfigs, CustomRegistry>) {
  const [{ hints, value, disabled, errors }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return hints.hidden ? null : (
    <SemanticForm.Checkbox
      required={config.validators?.some(v => v.name === "required")}
      label={config.label}
      checked={value}
      onChange={e => control.setValue(!value)}
      disabled={disabled}
      error={
        errors
          ? {
              content: Object.values(errors)[0].message,
            }
          : errors
      }
    />
  );
}

export function Select({
  config,
  control,
}: ConfigBundle<SelectConfig<unknown>, FieldControl<unknown | unknown[]>, CustomConfigs, CustomRegistry>) {
  const [state, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return <>asdf</>;
}

export function Message({ config, control }: ConfigBundle<MessageConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  const [{ hints, messages }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  const arrayMessages = Object.values(messages ?? {}).map(m => m.message);

  return hints.hidden ? null : (
    <SemanticMessage
      header={config.title}
      content={arrayMessages.length === 1 ? arrayMessages[0] : null}
      list={arrayMessages.length === 1 ? null : arrayMessages}
      info={config.chrome === "info"}
      error={config.chrome === "error"}
      warning={config.chrome === "warning"}
      success={config.chrome === "success"}
    />
  );
}

export function FormGroup({
  config,
  control,
  children,
}: ConfigBundle<FormGroupConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  return (
    <SemanticForm.Group>
      <Fields children={children}></Fields>
    </SemanticForm.Group>
  );
}

export function Button({
  config,
  control,
  registry,
}: ConfigBundle<ButtonConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  const [{ hints }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  const [trigger] = useState(() =>
    getRegistryValue<typeof registry, typeof config, typeof control, Trigger<typeof control>>(
      registry,
      "triggers",
      config,
      control,
      config.trigger,
    ),
  );

  return hints.hidden ? null : (
    <SemanticButton type={config.submit ? "submit" : "button"} onClick={() => trigger(control)}>
      {config.label}
    </SemanticButton>
  );
}
