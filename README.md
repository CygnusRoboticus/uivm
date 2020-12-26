# UIVM: User Interface View Models

A library for creating framework- and interface-agnostic view models with a variety of options.

## Installation and Usage

```sh
npm install uivm
yarn add uivm
```

Sample control usage. [Sandbox](https://codesandbox.io/s/morning-wood-3f8jx?file=/src/index.ts)

```ts
import { tuple } from "fp-ts/lib/function";
import { FieldControl, GroupControl } from "uivm";

const viewModel = new GroupControl({
  firstName: new FieldControl("John"),
  lastName: new FieldControl("Wick"),
  group: (() =>
    new GroupControl({
      username: new FieldControl("keanu@keanu.com"),
      password: new FieldControl(null, {
        hints: [() => tuple("private", true)],
      }),
      rememberMe: new FieldControl(false),
    }))(),
});

console.log(viewModel.value.group.username); // keanu@keanu.com
viewModel.state$.subscribe(console.log);
```

Sample config usage, this produces a view model identical to the above. [Sandbox](https://codesandbox.io/s/jolly-bogdan-y1kvz?file=/src/index.ts)

```ts
import { ControlVisitor, createConfigBuilder, FieldConfig, GroupConfig, GroupControl, ItemControl } from "uivm";

interface CustomGroupConfig extends GroupConfig<CustomConfigs, typeof registry>, FieldConfig<typeof registry> {
  type: "group";
}

interface TextConfig extends FieldConfig<typeof registry> {
  type: "text";
}

interface CheckboxConfig extends FieldConfig<typeof registry> {
  type: "checkbox";
}

type CustomConfigs = CustomGroupConfig | TextConfig | CheckboxConfig;

const config: CustomConfigs = {
  type: "group",
  name: "group",
  fields: [
    { type: "text", name: "firstName" },
    { type: "text", name: "lastName" },
    {
      type: "group",
      name: "group",
      fields: [
        { type: "text", name: "username" },
        {
          type: "text",
          name: "password",
          hints: {
            private: [{ name: "static", params: { value: true } }],
          },
        },
        { type: "checkbox", name: "rememberMe" },
      ],
    },
  ],
};

const registry = {
  hints: {
    static(config: CustomConfigs, control: ItemControl, { value }: { value: boolean }) {
      return (c: ItemControl) => value;
    },
  },
};

const visitor = new ControlVisitor<CustomConfigs, typeof registry>();
const bundler = createConfigBuilder<CustomConfigs, typeof registry, typeof visitor>(registry, visitor);

const bundle = bundler<
  GroupControl<{
    firstName: string;
    lastName: string;
    group: {
      username: string;
      password: string | null;
      rememberMe: boolean;
    };
  }>
>(config);
bundle.control.reset({
  firstName: "John",
  lastName: "Wick",
  group: {
    username: "keanu@keanu.com",
    password: null,
    rememberMe: false,
  },
});

bundle.control.state$.subscribe(console.log);
```

## Demo

https://cygnusroboticus.github.io/uivm

## Building/Testing

- `yarn build` build everything
- `yarn test` run tests
