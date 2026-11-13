-- The old constraint allowed only one primary AND only one secondary image per
-- property, capping every gallery at two photos. Only the primary flag must be
-- unique; the rest of a gallery is an ordered list.
DROP INDEX IF EXISTS "unique_primary_image";

CREATE UNIQUE INDEX "unique_primary_image"
  ON "property_images" ("property_id")
  WHERE "is_primary" = true;

CREATE INDEX IF NOT EXISTS "property_images_property_id_is_primary_idx"
  ON "property_images" ("property_id", "is_primary");
