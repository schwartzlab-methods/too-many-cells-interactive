module.exports = {
  preset: "ts-jest",
  roots: ["./src"],
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  moduleNameMapper: {
   "^d3-(.*)$": `d3-$1/dist/d3-$1`
  }
};
