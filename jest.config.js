module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  globals: {
    'ts-jest': {
      tsConfig: 'tsconfig.json'
    }
  }
};
