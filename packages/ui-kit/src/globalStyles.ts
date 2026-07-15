import { T } from "./tokens.js";

export const GLOBAL_CSS = `
  * { box-sizing: border-box; }
  html, body, #root { height: 100%; }
  body {
    margin: 0;
    background: ${T.black};
    color: ${T.white};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  a { color: ${T.brandL}; }
  button { font-family: inherit; }
  input, select, textarea { font-family: inherit; }
`;
