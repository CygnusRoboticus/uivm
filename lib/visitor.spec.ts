import { bundleConfig } from "./visitor";

describe("#bundleConfig", () => {
  test("happy path", () => {
    const config = {
      type: "form",
      fields: [{ type: "text", name: "field1" }],
    };
    const bundle = bundleConfig(config);
    expect(bundle.control).toBeTruthy();
    console.log(bundle);
  });
});
