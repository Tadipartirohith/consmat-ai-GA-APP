import { motion } from "framer-motion";
import { MapPin, Phone, Mail, BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StarRating from "@/components/StarRating";
import { pick } from "@/lib/format";

const initials = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "V";

export const ProfileHeader = ({ vendor }) => {
  const name = pick(vendor, ["name", "business_name", "shop_name", "vendor_name"], "Vendor");
  const location = pick(vendor, ["location", "address", "city", "area"]);
  const phone = pick(vendor, ["phone", "mobile", "contact", "phone_number"]);
  const email = pick(vendor, ["email", "contact_email"]);
  const category = pick(vendor, ["category", "business_type", "type"]);
  const rating = pick(vendor, ["rating", "avg_rating", "average_rating", "stars"], 0);
  const verified = pick(vendor, ["verified", "is_verified"], false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-lg border border-white/10 bg-[#171c22] p-5 sm:p-6"
      data-testid="vendor-profile-header"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border border-white/10 sm:h-16 sm:w-16">
            <AvatarFallback className="bg-[#ff7a2f]/10 text-lg font-bold text-[#ff7a2f]">
              {initials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1
                className="truncate font-heading text-xl font-extrabold tracking-tight sm:text-2xl"
                data-testid="vendor-name"
              >
                {name}
              </h1>
              {verified && <BadgeCheck size={18} className="shrink-0 text-[#ff7a2f]" />}
            </div>
            {category && (
              <p className="mt-0.5 text-sm text-[#94a3b8]" data-testid="vendor-category">
                {category}
              </p>
            )}
            <div className="mt-2">
              <StarRating value={rating} size={16} />
            </div>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-[#94a3b8] sm:text-right">
          {location && (
            <div className="flex items-center gap-2 sm:justify-end" data-testid="vendor-location">
              <MapPin size={14} className="text-[#ff7a2f]" />
              <span>{location}</span>
            </div>
          )}
          {phone && (
            <div className="flex items-center gap-2 sm:justify-end" data-testid="vendor-phone">
              <Phone size={14} className="text-[#ff7a2f]" />
              <span>{phone}</span>
            </div>
          )}
          {email && (
            <div className="flex items-center gap-2 sm:justify-end" data-testid="vendor-email">
              <Mail size={14} className="text-[#ff7a2f]" />
              <span className="truncate">{email}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default ProfileHeader;
