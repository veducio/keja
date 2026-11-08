#!/usr/bin/env bash
set -euo pipefail

rank_of() {
  case "$1" in
    major) printf "3" ;;
    minor) printf "2" ;;
    patch) printf "1" ;;
    *) printf "0" ;;
  esac
}

bump_for_message() {
  local message="$1"
  local subject type breaking line
  message="${message#"${message%%[![:space:]]*}"}"
  message="${message%"${message##*[![:space:]]}"}"
  if [[ -z "$message" ]]; then
    return 0
  fi
  local pattern='^([a-z]+)(\([^)]*\))?(!)?:([[:space:]]|$)'
  subject="${message%%$'\n'*}"
  subject="${subject%$'\r'}"
  if [[ ! "$subject" =~ $pattern ]]; then
    return 0
  fi
  type="${BASH_REMATCH[1]}"
  breaking="${BASH_REMATCH[3]:-}"
  if [[ "$breaking" == "!" ]]; then
    printf "major"
    return 0
  fi
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line%$'\r'}"
    if [[ "$line" =~ ^BREAKING[[:space:]-]CHANGE: ]]; then
      printf "major"
      return 0
    fi
  done <<< "$message"
  case "$type" in
    feat) printf "minor" ;;
    fix) printf "patch" ;;
  esac
}

selected=""
best=0
while IFS= read -r -d $'\x1e' message || [[ -n "$message" ]]; do
  bump="$(bump_for_message "$message")"
  if [[ -z "$bump" ]]; then
    continue
  fi
  score="$(rank_of "$bump")"
  if (( score > best )); then
    best="$score"
    selected="$bump"
  fi
done

if [[ -n "$selected" ]]; then
  printf "%s\n" "$selected"
fi
