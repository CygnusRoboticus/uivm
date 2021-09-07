import React, { useEffect, useState } from "react";
import { of } from "rxjs";
import { ComponentRegistry, createComponentBuilder } from "../src/component";
import { ArrayControl, FieldControl, ItemControl } from "../src/controls";
import { Messages, Trigger } from "../src/controls.types";
import { createSearchObservable, isOptionSingle, Option, SearchResolver } from "../src/search";
import { getRegistryValue, getRegistryValues } from "../src/visitor.utils";
import {
  ButtonConfig,
  CheckboxConfig,
  CustomConfigs,
  CustomExtras,
  CustomHints,
  FormConfig,
  MessageConfig,
  RepeaterConfig,
  SelectConfig,
  TextConfig,
} from "./react.configs";

export const BasicComponentMap: ComponentRegistry<CustomConfigs, any, JSX.Element, { index: number }> = {
  form: (control, { index: i } = { index: 0 }) => <Form key={i} control={control} />,
  text: (control, { index: i } = { index: 0 }) => <Text key={i} control={control} />,
  message: (control, { index: i } = { index: 0 }) => <Message key={i} control={control} />,
  button: (control, { index: i } = { index: 0 }) => <Button key={i} control={control} />,
  checkbox: (control, { index: i } = { index: 0 }) => <Checkbox key={i} control={control} />,
  select: (control, { index: i } = { index: 0 }) => <Select key={i} control={control} />,
  container: (control, { index: i } = { index: 0 }) => <Fields key={i} control={control} />,
  repeater: (control, { index: i } = { index: 0 }) => <Repeater key={i} control={control} />,
};

export const BasicBuilder = createComponentBuilder<CustomConfigs, any, JSX.Element, { index: number }>(
  BasicComponentMap,
  c => c.extras.config.type,
);

export function Fields({ control }: { control: ItemControl<CustomHints, CustomExtras<any>> }) {
  return <>{control.children.map((c, i) => BasicBuilder(c, { index: i }))}</>;
}

export function Form({ control }: { control: ItemControl<CustomHints, CustomExtras<FormConfig>> }) {
  return (
    <form>
      <Fields control={control}></Fields>
    </form>
  );
}

export function Text({ control }: { control: FieldControl<string, CustomHints, CustomExtras<TextConfig>> }) {
  const config = control.extras.config;
  const [{ value, errors, disabled }, setState] = useState(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return (
    <div style={{ marginBottom: "0.5rem" }}>
      {config.label ? <label>{config.label}</label> : null}
      <div>
        <input
          name={config.name}
          placeholder={config.placeholder}
          value={value ?? ""}
          onChange={e => control.setValue(e.currentTarget.value)}
          disabled={disabled}
        />
      </div>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Checkbox({ control }: { control: FieldControl<boolean, CustomHints, CustomExtras<CheckboxConfig>> }) {
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
    <div style={{ marginBottom: "0.5rem" }}>
      <input
        type="checkbox"
        name={config.name}
        checked={value}
        onChange={e => control.setValue(e.currentTarget.checked)}
        disabled={disabled}
        style={{ marginRight: "0.25rem" }}
      />
      {config.label ? <label>{config.label}</label> : null}
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Select({
  control,
}: {
  control: FieldControl<string, CustomHints, CustomExtras<SelectConfig<string>>>;
}) {
  const { config, registry } = control.extras;
  const [{ value, errors, disabled, hints }, setState] = useState(control.state);
  const [options, setOptions] = useState<readonly Option<string>[]>([]);
  useEffect(() => {
    control.state$.subscribe(setState);
    const searchers = getRegistryValues<
      typeof registry,
      typeof config,
      typeof control,
      SearchResolver<typeof control, Option<string>, string>
    >(registry, "search", config, control, config.options);
    createSearchObservable(of({ key: "", search: "", params: {}, control }), () => searchers).subscribe(o =>
      setOptions(o.result),
    );
  }, []);

  return hints.hidden ? null : (
    <div style={{ marginBottom: "0.5rem" }}>
      {config.label ? <label>{config.label}</label> : null}
      <div>
        <select
          name={config.name}
          value={value ?? ""}
          onChange={e => control.setValue(e.currentTarget.value)}
          disabled={disabled}
        >
          {options.filter(isOptionSingle).map((o, i) => (
            <option key={i} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {errors ? JSON.stringify(errors) : null}
    </div>
  );
}

export function Message({ control }: { control: ItemControl<CustomHints, CustomExtras<MessageConfig>> }) {
  const [messages, setMessage] = useState<Messages | null>();
  useEffect(() => {
    control.messages$.subscribe(setMessage);
  }, []);

  return (
    <fieldset>
      {Object.values(messages ?? {}).map((m, i) => (
        <div key={i}>{m.message}</div>
      ))}
    </fieldset>
  );
}

export function Repeater({ control }: { control: ArrayControl<{}, CustomHints, CustomExtras<RepeaterConfig>> }) {
  const { config } = control.extras;
  const [{ hints }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return hints.hidden ? null : (
    <div style={{ marginBottom: "0.5rem" }}>
      {config.label ? <label>{config.label}</label> : null}
      <Fields control={control}></Fields>
      <div style={{ margin: "0.5rem 0" }}>
        <button type="button" onClick={() => control.pushValue({})}>
          Add
        </button>
        <button type="button" onClick={() => control.pop()}>
          Remove
        </button>
      </div>
    </div>
  );
}

export function Button({ control }: { control: ItemControl<CustomHints, CustomExtras<ButtonConfig>> }) {
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
