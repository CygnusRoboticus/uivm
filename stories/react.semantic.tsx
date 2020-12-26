import React, { useEffect, useState } from "react";
import { of } from "rxjs";
import { map } from "rxjs/operators";
import "semantic-ui-css/semantic.min.css";
import { Button as SemanticButton, Form as SemanticForm, Input, Message as SemanticMessage } from "semantic-ui-react";
import { ComponentRegistry, createComponentBuilder } from "../src/component";
import { FieldControl, GroupControl, ItemControl } from "../src/controls";
import { Trigger } from "../src/controls.types";
import { createSearchObservable, OptionSingle, SearchResolver } from "../src/search";
import { Bundle } from "../src/visitor";
import { getRegistryValue, getRegistryValues } from "../src/visitor.utils";
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
import { CustomRegistry, registry } from "./registry";

export const SemanticComponentMap: ComponentRegistry<CustomConfigs, any, JSX.Element, CustomRegistry> = {
  form: b => Form(b),
  text: b => Text(b),
  message: b => Message(b),
  button: b => Button(b),
  checkbox: b => Checkbox(b),
  select: b => Select(b),
  formGroup: b => FormGroup(b),
};

export const SemanticBuilder = createComponentBuilder<CustomConfigs, any, JSX.Element, CustomRegistry>(
  SemanticComponentMap,
);

export function Fields({
  children,
}: {
  children: Bundle<CustomConfigs, ItemControl<CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>[];
}) {
  return (
    <>
      {children.map((c, i) => (
        <div key={i}>{SemanticBuilder(c)}</div>
      ))}
    </>
  );
}

export function Form({
  control,
  config,
  children,
}: Bundle<FormConfig, GroupControl<{}, {}, CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>) {
  return (
    <SemanticForm>
      <Fields children={children}></Fields>
    </SemanticForm>
  );
}

export function Text({
  config,
  control,
}: Bundle<
  TextConfig,
  FieldControl<string | null, CustomHints>,
  CustomConfigs,
  ItemControl<CustomHints>,
  CustomRegistry
>) {
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
}: Bundle<
  CheckboxConfig,
  FieldControl<boolean, CustomHints>,
  CustomConfigs,
  ItemControl<CustomHints>,
  CustomRegistry
>) {
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
}: Bundle<SelectConfig<unknown>, FieldControl<unknown[], CustomHints>, CustomConfigs, any, CustomRegistry>) {
  const [{ value, errors, disabled, hints }, setState] = useState(control.state);
  const [options, setOptions] = useState<readonly OptionSingle<unknown>[]>([]);
  useEffect(() => {
    control.state$.subscribe(setState);
    const searchers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      SearchResolver<typeof control, OptionSingle<unknown>, unknown>
    >(registry, "search", config, control, config.options);
    createSearchObservable(of({ key: "", search: "", params: {}, control }), () => searchers)
      .pipe(map(o => o.result))
      .subscribe(setOptions);
  }, []);

  return hints.hidden ? null : (
    <SemanticForm.Select
      required={config.validators?.some(v => v.name === "required")}
      label={config.label}
      value={value as string[]}
      onChange={(_, e) => control.setValue(e.value as any)}
      disabled={disabled}
      options={options.map(o => ({
        description: o.sublabel,
        disabled: o.disabled,
        icon: o.icon?.name,
        text: o.label,
        value: o.value as string,
      }))}
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

export function Message({
  config,
  control,
}: Bundle<MessageConfig, ItemControl<CustomHints>, CustomConfigs, any, CustomRegistry>) {
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
}: Bundle<FormGroupConfig, ItemControl<CustomHints>, CustomConfigs, any, CustomRegistry>) {
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
}: Bundle<ButtonConfig, ItemControl<CustomHints>, CustomConfigs, any, CustomRegistry>) {
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
