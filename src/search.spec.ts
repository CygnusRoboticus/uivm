import { readonlyArray as RAR } from "fp-ts";
import { Subject } from "rxjs";
import { map, toArray } from "rxjs/operators";
import { createResolveObservable, createSearchObservable, SearchResolverPagination } from "./search";

function tick(delay = 0) {
  return new Promise(resolve => setTimeout(resolve, delay));
}

describe("createSearchObservable", () => {
  type ObsInput = { search: string; control: any; params: object; paging: SearchResolverPagination; key: string };
  test("delays correctly", async () => {
    const obs = new Subject<ObsInput>();
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(obs, () => resolvers, 500);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v).toEqual([["pants3"], ["pants4"]]);
    });
    obs.next({ search: "pants1", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    await tick(200);
    obs.next({ search: "pants2", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    await tick(400);
    obs.next({ search: "pants3", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    await tick(550);
    obs.next({ search: "pants4", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    await tick(550);
    obs.complete();
    expect.assertions(1);
  });

  test("groups identical search operations", async () => {
    const obs = new Subject<ObsInput>();
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createSearchObservable(obs, () => resolvers);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v.length).toEqual(2);
      expect(v).toEqual(expect.arrayContaining([["skirts2"], ["pants4"]]));
    });
    obs.next({ search: "pants1", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    obs.next({ search: "skirts1", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "skirts" });
    obs.next({ search: "pants2", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    obs.next({ search: "skirts2", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "skirts" });
    await tick();
    obs.next({ search: "pants3", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    obs.next({ search: "pants4", control: {}, params: {}, paging: { take: 10, skip: 0 }, key: "pants" });
    await tick(550);
    obs.complete();
    expect.assertions(2);
  });
});

describe("createResolveObservable", () => {
  test("groups identical resolve operations", async () => {
    const obs = new Subject<{ values: string[]; control: any; params: object; key: string }>();
    const resolvers = [{ search: (q: string) => [q], resolve: (v: string[]) => v }];
    const searchObs = createResolveObservable(obs, () => resolvers);
    searchObs.pipe(toArray(), map(RAR.map(v => v.result))).subscribe(v => {
      expect(v).toEqual([["pants", "skirts", "shorts"], ["skirts"], ["pants"]]);
    });
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "pants" });
    obs.next({ values: ["skirts"], control: {}, params: {}, key: "skirts" });
    await tick();
    obs.next({ values: ["shorts"], control: {}, params: {}, key: "pants" });
    await tick(550);
    obs.next({ values: ["pants"], control: {}, params: {}, key: "pants" });
    obs.complete();
    expect.assertions(1);
  });
});
