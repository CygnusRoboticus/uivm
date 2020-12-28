import React, { useEffect, useState } from "react";
import { of } from "rxjs";
import { ComponentRegistry, createComponentBuilder } from "../src/component";
import { FieldControl, GroupControl, ItemControl } from "../src/controls";
import { Messages, Trigger } from "../src/controls.types";
import { createSearchObservable, OptionSingle, SearchResolver } from "../src/search";
import { getRegistryValue, getRegistryValues } from "../src/visitor.utils";
import { CustomConfigs } from "./react.configs";

export const BasicComponentMap: ComponentRegistry<CustomConfigs, any, JSX.Element, { index: number }> = {
  form: (control, { index: i } = { index: 0 }) => <Form key={i} control={control} />,
  text: (control, { index: i } = { index: 0 }) => <Text key={i} control={control} />,
  message: (control, { index: i } = { index: 0 }) => <Message key={i} control={control} />,
  button: (control, { index: i } = { index: 0 }) => <Button key={i} control={control} />,
  checkbox: (control, { index: i } = { index: 0 }) => <Checkbox key={i} control={control} />,
  select: (control, { index: i } = { index: 0 }) => <Select key={i} control={control} />,
  formGroup: (control, { index: i } = { index: 0 }) => <FormGroup key={i} control={control} />,
  repeater: (control, { index: i } = { index: 0 }) => <Fields key={i} control={control} />,
};

export const BasicBuilder = createComponentBuilder<CustomConfigs, any, JSX.Element, { index: number }>(
  BasicComponentMap,
  c => c.extras.config.type,
);

export function Fields({ control }: { control: ItemControl<any, any> }) {
  return <>{control.children.map((c, i) => BasicBuilder(c, { index: i }))}</>;
}

export function Form({ control }: { control: ItemControl<any, any> }) {
  return (
    <form>
      <Fields control={control}></Fields>
    </form>
  );
}

export function Text({ control }: { control: FieldControl<string, any, any> }) {
  const config = control.extras.config;
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

export function Checkbox({ control }: { control: FieldControl<boolean, any, any> }) {
  const config = control.extras.config;
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

export function Select({ control }: { control: FieldControl<string, any, any> }) {
  const { config, registry } = control.extras;
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

export function Message({ control }: { control: ItemControl<any, any> }) {
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

export function FormGroup({ control }: { control: GroupControl<{}, any, any> }) {
  return (
    <>
      <Fields control={control}></Fields>
    </>
  );
}

export function Button({ control }: { control: ItemControl<any, any> }) {
  const { config, registry } = control.extras;
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
