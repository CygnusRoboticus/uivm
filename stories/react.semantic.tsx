import React, { useEffect, useState } from "react";
import "semantic-ui-css/semantic.min.css";
import { Button as SemanticButton, Form as SemanticForm, Input, Message as SemanticMessage } from "semantic-ui-react";
import { FieldControl, GroupControl, ItemControl } from "../lib/controls";
import { Trigger } from "../lib/controls.types";
import { ConfigBundle, getRegistryValue } from "../lib/visitor";
import {
  ButtonConfig,
  CheckboxConfig,
  CustomConfigs,
  CustomHints,
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
  children: ConfigBundle<CustomConfigs, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>[];
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
}: ConfigBundle<FormConfig, GroupControl<{}, {}, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  return (
    <SemanticForm>
      <Fields children={children}></Fields>
    </SemanticForm>
  );
}

export function Text({
  config,
  control,
}: ConfigBundle<TextConfig, FieldControl<string | null, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
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
}: ConfigBundle<CheckboxConfig, FieldControl<boolean, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
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
}: ConfigBundle<
  SelectConfig<unknown>,
  FieldControl<unknown | unknown[], CustomHints>,
  CustomConfigs,
  CustomRegistry,
  CustomHints
>) {
  const [state, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return <>asdf</>;
}

export function Message({
  config,
  control,
}: ConfigBundle<MessageConfig, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  const [{ hints, messages, extras }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  const arrayMessages = Object.values(messages ?? {}).map(m => m.message);
  const chrome = extras.chrome ?? config.chrome;

  return hints.hidden ? null : (
    <SemanticMessage
      header={config.title}
      content={arrayMessages.length === 1 ? arrayMessages[0] : null}
      list={arrayMessages.length === 1 ? null : arrayMessages}
      info={chrome === "info"}
      error={chrome === "error"}
      warning={chrome === "warning"}
      success={chrome === "success"}
    />
  );
}

export function FormGroup({
  config,
  control,
  children,
}: ConfigBundle<FormGroupConfig, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
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
}: ConfigBundle<ButtonConfig, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  const [{ hints }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  const [trigger] = useState(() =>
    getRegistryValue<typeof registry, typeof config, typeof control, Trigger<typeof control>, CustomHints>(
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
