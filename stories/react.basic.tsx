import React, { useEffect, useState } from "react";
import { FieldControl, GroupControl, ItemControl } from "../lib/controls";
import { AbstractExtras, AbstractHints, Messages, Trigger } from "../lib/controls.types";
import {
  ExecutableDefinitionDefault,
  ExecutableDefinition,
  FuzzyExecutableRegistry,
  OptionSingle,
  SearchResolver,
} from "../lib/executable";
import { ConfigBundle, getRegistryMethod, getRegistryValue, getRegistryValues } from "../lib/visitor";
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
import { createSearchObservable } from "../lib/search";
import { of } from "rxjs";
import { BaseItemConfig } from "../lib/primitives";

export const BasicComponentMap = new Map<CustomConfigs["type"], React.ComponentFactory<any, any>>([
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
}: ConfigBundle<FormConfig, GroupControl<{}, {}, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  return (
    <form>
      <Fields children={children}></Fields>
    </form>
  );
}

export function Text({
  id,
  config,
  control,
}: ConfigBundle<TextConfig, FieldControl<string | null, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  const [{ value, errors, disabled }, setState] = useState(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return (
    <div>
      {config.label ? <label htmlFor={id}>{config.label}</label> : null}
      <br />
      <input
        name={config.name}
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
  id,
  config,
  control,
}: ConfigBundle<CheckboxConfig, FieldControl<boolean, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  const [value, setValue] = useState<boolean>(false);
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
        name={config.name}
        checked={value}
        onChange={e => control.setValue(e.currentTarget.checked)}
        disabled={disabled}
      />
      <label htmlFor={id}>{config.label}</label>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Select({
  id,
  config,
  control,
  registry,
}: ConfigBundle<SelectConfig<unknown>, FieldControl<string, CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
  const [{ value, errors, disabled, hints }, setState] = useState(control.state);
  const [options, setOptions] = useState<OptionSingle<string>[]>([]);
  useEffect(() => {
    control.state$.subscribe(setState);
    const searchers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      SearchResolver<typeof control, unknown, object, CustomHints>,
      CustomHints
    >(registry, "search", config, control, config.options);
    createSearchObservable(searchers, of({ key: "", search: "", params: {}, control })).subscribe(setOptions);
  }, []);

  return hints.hidden ? null : (
    <div>
      {config.label ? <label htmlFor={id}>{config.label}</label> : null}
      <br />
      <select
        name={config.name}
        id={id}
        value={value ?? ""}
        onChange={e => control.setValue(e.currentTarget.value)}
        disabled={disabled}
      >
        {options.map((o, i) => (
          <option key={i} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Message({
  config,
  control,
}: ConfigBundle<MessageConfig, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
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
}: ConfigBundle<FormGroupConfig, ItemControl<CustomHints>, CustomConfigs, CustomRegistry, CustomHints>) {
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
    <button type={config.submit ? "submit" : "button"} onClick={() => trigger(control)}>
      {config.label}
    </button>
  );
}
