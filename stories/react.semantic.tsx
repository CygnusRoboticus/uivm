import React, { useEffect, useState } from "react";
import { of } from "rxjs";
import { map } from "rxjs/operators";
import "semantic-ui-css/semantic.min.css";
import { Button as SemanticButton, Form as SemanticForm, Input, Message as SemanticMessage } from "semantic-ui-react";
import { ComponentRegistry, createComponentBuilder } from "../src/component";
import { ArrayControl, FieldControl, GroupControl, ItemControl } from "../src/controls";
import { Trigger } from "../src/controls.types";
import { createSearchObservable, isOptionSingle, Option, SearchResolver } from "../src/search";
import { getRegistryValue, getRegistryValues } from "../src/visitor.utils";
import {
  ButtonConfig,
  CheckboxConfig,
  CustomConfigs,
  CustomExtras,
  CustomHints,
  CustomRegistry,
  FormConfig,
  MessageConfig,
  RepeaterConfig,
  SelectConfig,
  TextConfig,
} from "./react.configs";

export const SemanticComponentMap: ComponentRegistry<CustomConfigs, any, JSX.Element, { index: number }> = {
  form: (control, { index: i } = { index: 0 }) => <Form key={i} control={control} />,
  text: (control, { index: i } = { index: 0 }) => <Text key={i} control={control} />,
  message: (control, { index: i } = { index: 0 }) => <Message key={i} control={control} />,
  button: (control, { index: i } = { index: 0 }) => <Button key={i} control={control} />,
  checkbox: (control, { index: i } = { index: 0 }) => <Checkbox key={i} control={control} />,
  select: (control, { index: i } = { index: 0 }) => <Select key={i} control={control} />,
  container: (control, { index: i } = { index: 0 }) => <FormGroup key={i} control={control} />,
  repeater: (control, { index: i } = { index: 0 }) => <Repeater key={i} control={control} />,
};

export const SemanticBuilder = createComponentBuilder<CustomConfigs, any, JSX.Element, { index: number }>(
  SemanticComponentMap,
  c => c.extras.config.type,
);

export function Fields({ control }: { control: ItemControl<CustomHints, CustomExtras<any>> }) {
  return <>{control.children.map((c, i) => SemanticBuilder(c, { index: i }))}</>;
}

export function Form({ control }: { control: GroupControl<{}, CustomHints, CustomExtras<FormConfig>> }) {
  return (
    <SemanticForm>
      <Fields control={control}></Fields>
    </SemanticForm>
  );
}

export function Text({ control }: { control: FieldControl<string, CustomHints, CustomExtras<TextConfig>> }) {
  const config = control.extras.config;
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

export function Checkbox({ control }: { control: FieldControl<boolean, CustomHints, CustomExtras<CheckboxConfig>> }) {
  const config = control.extras.config;
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
  control,
}: {
  control: FieldControl<string | string[], CustomHints, CustomExtras<SelectConfig>>;
}) {
  const { config, registry } = control.extras;
  const [{ value, errors, disabled, hints }, setState] = useState(control.state);
  const [options, setOptions] = useState<readonly Option<unknown>[]>([]);
  useEffect(() => {
    control.state$.subscribe(setState);
    const searchers = getRegistryValues<
      CustomRegistry,
      typeof config,
      typeof control,
      SearchResolver<typeof control, Option<unknown>, unknown>
    >(registry, "search", config, control, config.options);
    createSearchObservable(of({ key: "", search: "", params: {}, control }), () => searchers)
      .pipe(map(o => o.result))
      .subscribe(setOptions);
  }, []);

  return hints.hidden ? null : (
    <SemanticForm.Select
      required={config.validators?.some(v => v.name === "required")}
      label={config.label}
      value={value as string | string[]}
      onChange={(_, e) => control.setValue(e.value as string | string[])}
      disabled={disabled}
      options={options.filter(isOptionSingle).map(o => ({
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

export function Message({ control }: { control: ItemControl<CustomHints, CustomExtras<MessageConfig>> }) {
  const config = control.extras.config;
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

export function FormGroup({ control }: { control: ItemControl<CustomHints, CustomExtras<any>> }) {
  return (
    <SemanticForm.Group>
      <Fields control={control}></Fields>
    </SemanticForm.Group>
  );
}

export function Repeater({ control }: { control: ArrayControl<{}, CustomHints, CustomExtras<RepeaterConfig>> }) {
  const { config } = control.extras;
  const [{ hints }, setState] = useState<typeof control["state"]>(control.state);
  useEffect(() => {
    control.state$.subscribe(setState);
  }, []);

  return hints.hidden ? null : (
    <SemanticForm.Field>
      {config.label ? <label>{config.label}</label> : null}
      <>
        {control.children.map((c, i) => (
          <FormGroup key={i} control={c}></FormGroup>
        ))}
        <div style={{ margin: "1rem 0" }}>
          <SemanticButton type="button" onClick={() => control.add()}>
            Add
          </SemanticButton>
          <SemanticButton type="button" onClick={() => control.pop()}>
            Remove
          </SemanticButton>
        </div>
      </>
    </SemanticForm.Field>
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
    <SemanticButton type={config.submit ? "submit" : "button"} onClick={() => trigger(control)}>
      {config.label}
    </SemanticButton>
  );
}
