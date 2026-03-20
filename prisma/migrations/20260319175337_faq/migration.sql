-- CreateTable
CREATE TABLE "faq_categories" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "faq_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_items" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "faq_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "faq_categories_position_idx" ON "faq_categories"("position");

-- CreateIndex
CREATE INDEX "faq_items_category_id_position_idx" ON "faq_items"("category_id", "position");

-- AddForeignKey
ALTER TABLE "faq_categories" ADD CONSTRAINT "faq_categories_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_categories" ADD CONSTRAINT "faq_categories_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "faq_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_items" ADD CONSTRAINT "faq_items_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "admins"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
