# Unity + ToLua Verification

Unity + ToLua profiles add repository checks to `oslite docs verify`.

The verifier remains profile-scoped: generic repositories do not receive Unity-specific checks.

## Checked As Failures

- Required profile anchors exist, such as `Script/MJGame.lua` for `unity-tolua-game`.
- At least one Lua file exists in the repository.

These failures block verification because they mean the selected profile may not match the repository.

## Checked As Warnings

- ToLua or LuaFramework path signals are missing.
- No EmmyLua annotations are found in Lua files.

Warnings do not block verification because many legacy Unity projects adopt annotations gradually. They are still emitted in JSON and human output so agents can call them out during docs work.

## Agent Expectations

For Lua code, agents should use EmmyLua annotations for classes and for complicated functions or functions with multiple vague parameters. In review and bug-fix work, agents should inspect real startup and binding paths before assuming how Unity and Lua communicate.

## JSON Output

Use:

```sh
oslite docs verify . --json
```

The result includes `repoChecks`, `issues`, and `warnings` so agents can distinguish blocking profile mismatches from advisory quality gaps.
