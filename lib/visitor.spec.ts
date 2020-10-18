import { bundleConfig } from "./visitor";

describe("#bundleConfig", () => {
  test("item config", () => {
    const config = { type: "message", message: "i have no values" };
    const bundle = bundleConfig(config);
    expect(bundle.control).toBeTruthy();
    expect(bundle.items.length).toEqual(1);
  });

  test("field config", () => {
    const config = { type: "text", name: "text" };
    const bundle = bundleConfig(config);
    expect(bundle.control).toBeTruthy();
    expect(bundle.items).toEqual([]);
    expect(bundle.control.value).toEqual({ text: null });
  });

  test("group config", () => {
    const config = {
      type: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle.control).toBeTruthy();
    expect(bundle.items.length).toEqual(1);
    expect(bundle.control.value).toEqual({ text: null });
  });

  test("group & field config", () => {
    const config = {
      type: "group",
      name: "group",
      fields: [{ type: "text", name: "text" }, { type: "message" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle.control).toBeTruthy();
    expect(bundle.items.length).toEqual(1);
    expect(bundle.control.value).toEqual({ group: { text: null } });
  });

  test("nested group configs", () => {
    const config = {
      type: "group",
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
    expect(bundle.control).toBeTruthy();
    expect(bundle.items.length).toEqual(2);
    expect(bundle.control.value).toEqual({
      text: null,
      checkbox: null,
      group: { select: null },
    });
  });
});
