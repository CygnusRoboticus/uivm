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
  group: new GroupControl({
    username: new FieldControl(null),
    password: new FieldControl(null, {
      hints: [() => tuple("private", true)],
    }),
    rememberMe: new FieldControl(false),
  }),
});

viewModel.state$.subscribe(console.log);
```

Sample config usage, this produces a view model identical to the above. [Sandbox](https://codesandbox.io/s/jolly-bogdan-y1kvz?file=/src/index.ts)

```ts
import { ItemControl, FieldConfig, GroupConfig, FieldTypeMap, bundleConfig } from "uivm";

const config = {
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
          hints: { private: [{ name: "static", params: { value: true } }] },
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

interface CustomGroupConfig extends GroupConfig<CustomConfigs>, FieldConfig<typeof registry> {
  type: "group";
}

interface TextConfig extends FieldConfig<typeof registry> {
  type: "text";
}

interface CheckboxConfig extends FieldConfig<typeof registry> {
  type: "checkbox";
}

type CustomConfigs = CustomGroupConfig | TextConfig | CheckboxConfig;
type CustomConfigsTypes = FieldTypeMap<CustomConfigs, { type: "text" }, never, { type: "checkbox" }, never, never>;

const bundle = bundleConfig<typeof config, CustomConfigs, CustomConfigsTypes, typeof registry>(config, registry, {
  firstName: "John",
  lastName: "Wick",
  group: {
    username: null,
    password: null,
    rememberMe: false,
  },
});

bundle.control.state$.subscribe(s => {
  console.log(s);
  document.getElementById("app").innerHTML = `
    <pre>${JSON.stringify(s, null, 2)}</pre>
  `;
});
```

## Demo

https://cygnusroboticus.github.io/uivm

## Building/Testing

- `yarn build` build everything
- `yarn test` run tests
