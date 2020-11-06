import React, { useEffect, useState } from "react";
import "semantic-ui-css/semantic.min.css";
import { Button as SemanticButton, Form as SemanticForm, Input, Message as SemanticMessage } from "semantic-ui-react";
import { AbstractFlags, Messages } from "../lib/configs";
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

export const SemanticComponentMap = new Map<CustomConfigs["type"], React.ComponentFactory<any, any>>([
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
  const [value, setValue] = useState<string | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState<Messages | null>(null);
  const [flags, setFlags] = useState<AbstractFlags>({});

  useEffect(() => {
    control.value$.subscribe(setValue);
    control.disabled$.subscribe(setDisabled);
    control.errors$.subscribe(setErrors);
    control.flags$.subscribe(setFlags);
  }, []);

  return flags.hidden ? null : (
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
  const [value, setValue] = useState<boolean | null>(null);
  const [disabled, setDisabled] = useState(false);
  const [errors, setErrors] = useState<Messages | null>(null);

  useEffect(() => {
    control.value$.subscribe(setValue);
    control.disabled$.subscribe(setDisabled);
    control.errors$.subscribe(setErrors);
  }, []);

  return (
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

export function Message({ config, control }: ConfigBundle<MessageConfig, ItemControl, CustomConfigs, CustomRegistry>) {
  const [messages, setMessage] = useState<Messages | null>();
  useEffect(() => {
    control.messages$.subscribe(setMessage);
  }, []);

  const arrayMessages = Object.values(messages ?? {}).map(m => m.message);

  return (
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
  const [trigger] = useState(() =>
    getRegistryMethod<typeof registry, Executor<any, any>, typeof control["flags"]>(
      registry,
      "triggers",
      config.trigger,
    ),
  );
  return (
    <SemanticButton
      type={config.submit ? "submit" : "button"}
      onClick={() => trigger(config, control, config.trigger.params)(control)}
    >
      {config.label}
    </SemanticButton>
  );
}
