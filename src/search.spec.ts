import { Subject } from "rxjs";
import { readonlyArray as RAR } from "fp-ts";
import { map, toArray } from "rxjs/operators";
import { createResolveObservable, createSearchObservable } from "./search";

function tick(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

describe("createSearchObservable", () => {
  let obs: Subject<{ search: string; control: any; params: object; key: string }>;

  beforeEach(() => {
    obs = new Subject();
  });

  test("delays correctly", async done => {
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(obs, () => resolvers, 500);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v).toEqual([["pants3"], ["pants4"]]);
      done();
    });
    obs.next({ search: "pants1", control: {}, params: {}, key: "pants" });
    await tick(200);
    obs.next({ search: "pants2", control: {}, params: {}, key: "pants" });
    await tick(400);
    obs.next({ search: "pants3", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.next({ search: "pants4", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.complete();
  });

  test("groups identical search operations", async done => {
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(obs, () => resolvers);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v).toEqual([["skirts2"], ["pants4"]]);
      done();
    });
    obs.next({ search: "pants1", control: {}, params: {}, key: "pants" });
    obs.next({ search: "skirts1", control: {}, params: {}, key: "skirts" });
    obs.next({ search: "pants2", control: {}, params: {}, key: "pants" });
    obs.next({ search: "skirts2", control: {}, params: {}, key: "skirts" });
    await tick();
    obs.next({ search: "pants3", control: {}, params: {}, key: "pants" });
    obs.next({ search: "pants4", control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.complete();
  });
});

describe("createResolveObservable", () => {
  let obs: Subject<{ values: string[]; control: any; params: object; key: string }>;

  beforeEach(() => {
    obs = new Subject();
  });

  test("groups identical resolve operations", async done => {
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createResolveObservable(obs, () => resolvers);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v).toEqual([["pants", "skirts", "shorts"], ["skirts"], ["pants"]]);
      done();
    });
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "skirts" });
    await tick();
    obs.next({ values: ["shorts"], control: {}, params: {}, key: "pants" });
    await tick(501);
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.complete();
  });
});
