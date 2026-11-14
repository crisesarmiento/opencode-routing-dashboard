#!/usr/bin/env bun
import { LEGACY_BIN_NAME, main } from "./cli";

if (import.meta.main) await main(LEGACY_BIN_NAME);
