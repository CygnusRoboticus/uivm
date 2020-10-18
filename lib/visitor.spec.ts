import { AnyConfig, FormConfig } from "./configs";
import { bundleConfig } from "./visitor";

describe("#bundleConfig", () => {
  test("item config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "message" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(1);
    expect(bundle.children[0].children.length).toEqual(0);
  });

  test("basic field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(1);
    expect(bundle.children[0].children.length).toEqual(0);
    expect(bundle.value).toEqual({ text: null });
  });

  test("group config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(2);
    expect(bundle.value).toEqual({ text: null });
  });

  test("group & field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(2);
    expect(bundle.value).toEqual({ text: null });
  });

  test("nested group configs", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [
        { type: "text", name: "text" },
        { type: "message" },
        {
          type: "group",
          fields: [
            { type: "checkbox", name: "checkbox" },
            { type: "message" },
            { type: "group", name: "group", fields: [{ type: "select", name: "select" }] },
          ],
        },
      ],
    };
    const bundle = bundleConfig(config);
    expect(bundle).toBeTruthy();
    expect(bundle.children.length).toEqual(3);
    expect(bundle.children[2].children.length).toEqual(3);
    expect(bundle.children[2].children[2].children.length).toEqual(1);
    expect(bundle.value).toEqual({
      text: null,
      checkbox: null,
      group: { select: null },
    });
  });
});
