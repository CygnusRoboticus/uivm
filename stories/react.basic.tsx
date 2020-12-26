import React, { useEffect, useState } from "react";
import { of } from "rxjs";
import { ComponentRegistry, createComponentBuilder } from "../src/component";
import { FieldControl, GroupControl, ItemControl } from "../src/controls";
import { Messages, Trigger } from "../src/controls.types";
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
import { CustomRegistry } from "./registry";

export const BasicComponentMap: ComponentRegistry<
  CustomConfigs,
  any,
  JSX.Element,
  CustomRegistry,
  { index: number }
> = {
  form: (b, { index: i } = { index: 0 }) => <Form key={i} {...b} />,
  text: (b, { index: i } = { index: 0 }) => <Text key={i} {...b} />,
  message: (b, { index: i } = { index: 0 }) => <Message key={i} {...b} />,
  button: (b, { index: i } = { index: 0 }) => <Button key={i} {...b} />,
  checkbox: (b, { index: i } = { index: 0 }) => <Checkbox key={i} {...b} />,
  select: (b, { index: i } = { index: 0 }) => <Select key={i} {...b} />,
  formGroup: (b, { index: i } = { index: 0 }) => <FormGroup key={i} {...b} />,
};

export const BasicBuilder = createComponentBuilder<CustomConfigs, any, JSX.Element, CustomRegistry, { index: number }>(
  BasicComponentMap,
);

export function Fields({
  children,
}: {
  children: Bundle<CustomConfigs, ItemControl<CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>[];
}) {
  return <>{children.map((c, i) => BasicBuilder(c, { index: i }))}</>;
}

export function Form({
  control,
  config,
  children,
}: Bundle<FormConfig, GroupControl<{}, {}, CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>) {
  return (
    <form>
      <Fields children={children}></Fields>
    </form>
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
  const [{ value, errors, disabled }, setState] = useState(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return (
    <div>
      {config.label ? <label>{config.label}</label> : null}
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
  config,
  control,
}: Bundle<
  CheckboxConfig,
  FieldControl<boolean, CustomHints>,
  CustomConfigs,
  ItemControl<CustomHints>,
  CustomRegistry
>) {
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
      <label>{config.label}</label>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Select({
  config,
  control,
  registry,
}: Bundle<
  SelectConfig<unknown>,
  FieldControl<string, CustomHints>,
  CustomConfigs,
  ItemControl<CustomHints>,
  CustomRegistry
>) {
  const [{ value, errors, disabled, hints }, setState] = useState(control.state);
  const [options, setOptions] = useState<readonly OptionSingle<string>[]>([]);
  useEffect(() => {
    control.state$.subscribe(setState);
    const searchers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      SearchResolver<typeof control, OptionSingle<string>, string>
    >(registry, "search", config, control, config.options);
    createSearchObservable(of({ key: "", search: "", params: {}, control }), () => searchers).subscribe(o =>
      setOptions(o.result),
    );
  }, []);

  return hints.hidden ? null : (
    <div>
      {config.label ? <label>{config.label}</label> : null}
      <br />
      <select
        name={config.name}
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
}: Bundle<MessageConfig, ItemControl<CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>) {
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
}: Bundle<FormGroupConfig, ItemControl<CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>) {
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
}: Bundle<ButtonConfig, ItemControl<CustomHints>, CustomConfigs, ItemControl<CustomHints>, CustomRegistry>) {
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
    <button type={config.submit ? "submit" : "button"} onClick={() => trigger(control)}>
      {config.label}
    </button>
  );
}
