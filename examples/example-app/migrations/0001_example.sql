create table users (
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt")),
  name text not null,
  email text not null
);

create table posts (
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt")),
  title text not null,
  author_id text not null
);

create table jobs (
  _id text primary key check (keja_is_typeid(_id)),
  _object text not null check (keja_is_object_type(_object)),
  _tenant text not null check (keja_is_tenant(_tenant)),
  _archived boolean not null default false,
  "_createdAt" timestamptz not null,
  "_updatedAt" timestamptz not null,
  check (keja_timestamps("_createdAt", "_updatedAt")),
  name text not null
);
