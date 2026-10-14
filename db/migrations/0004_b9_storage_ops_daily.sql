CREATE TABLE "storage_ops_daily" (
	"day" date PRIMARY KEY NOT NULL,
	"class_a" bigint DEFAULT 0 NOT NULL,
	"class_b" bigint DEFAULT 0 NOT NULL
);
