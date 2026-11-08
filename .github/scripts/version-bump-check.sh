#!/usr/bin/env bash
set -euo pipefail

rs=$'\x1e'
fail=0

check() {
  local name="$1"
  local input="$2"
  local want="$3"
  local got
  got="$(printf "%s" "$input" | bash .github/scripts/version-bump.sh)"
  if [[ "$got" != "$want" ]]; then
    printf "FAIL %s: got [%s] want [%s]\n" "$name" "$got" "$want"
    fail=1
    return 0
  fi
  printf "ok %s\n" "$name"
}

check feat "feat: add health route${rs}" minor
check scope "feat(server): add health route${rs}" minor
check fix "fix: reject an empty host${rs}" patch
check bang "feat!: replace the response${rs}" major
check scopebang "fix(api)!: drop the old port${rs}" major
check footer "$(printf "feat: add health route\n\nBREAKING CHANGE: shape changed%s" "$rs")" major
check chore "chore: release v0.1.1${rs}" ""
check docs "docs: describe the server${rs}" ""
check plain "update the server${rs}" ""
check highest "docs: describe the server${rs}fix: reject an empty host${rs}feat: add health route${rs}" minor
check breakhighest "feat: add health route${rs}fix!: drop the old route${rs}" major
check none "chore: tidy${rs}${rs}" ""

exit "$fail"
