import * as z from "zod";


export const DirectionSchema = z.enum([
    "Bottom",
    "Top",
]);
export type Direction = z.infer<typeof DirectionSchema>;


export const EntSchema = z.enum([
    "tweet",
]);
export type Ent = z.infer<typeof EntSchema>;


export const ConversationSectionSchema = z.enum([
    "HighQuality",
]);
export type ConversationSection = z.infer<typeof ConversationSectionSchema>;


export const ControllerDataSchema = z.enum([
    "DAACDAAEDAABCgABAAAAAAAAAAEKAAIAAAAAAAAAAAoAAwAAAZxNCn9kAAAAAA==",
    "DAACDAAEDAABCgABAAAAAAAAAAEKAAIAAAAAAAAAAAoAAwAAAZxNCytBAAAAAA==",
    "DAACDAAEDAABCgABAAAAAAAAAAEKAAIAAAAAAAAAAAoAAwAAAZxNC1rCAAAAAA==",
    "DAACDAAEDAABCgABAAAAAAAAAAEKAAIAAAAAAAAAAAoAAwAAAZxNC6niAAAAAA==",
    "DAACDAAEDAABCgABAAAAAAAAAAEKAAIAAAAAAAAAAAoAAwAAAZxNDADDAAAAAA==",
]);
export type ControllerData = z.infer<typeof ControllerDataSchema>;


export const DisplayTypeSchema = z.enum([
    "VerticalConversation",
]);
export type DisplayType = z.infer<typeof DisplayTypeSchema>;


export const EntryTypeEnumSchema = z.enum([
    "TimelineTimelineCursor",
    "TimelineTimelineItem",
    "TimelineTimelineModule",
]);
export type EntryTypeEnum = z.infer<typeof EntryTypeEnumSchema>;


export const ItemTypeEnumSchema = z.enum([
    "TimelineTweet",
]);
export type ItemTypeEnum = z.infer<typeof ItemTypeEnumSchema>;


export const TweetDisplayTypeSchema = z.enum([
    "SelfThread",
    "Tweet",
]);
export type TweetDisplayType = z.infer<typeof TweetDisplayTypeSchema>;


export const ProfileInterstitialTypeSchema = z.enum([
    "",
    "sensitive_media",
]);
export type ProfileInterstitialType = z.infer<typeof ProfileInterstitialTypeSchema>;


export const TranslatorTypeSchema = z.enum([
    "none",
    "regular",
]);
export type TranslatorType = z.infer<typeof TranslatorTypeSchema>;


export const ParodyCommentaryFanLabelSchema = z.enum([
    "Commentary",
    "None",
]);
export type ParodyCommentaryFanLabel = z.infer<typeof ParodyCommentaryFanLabelSchema>;


export const IconNameSchema = z.enum([
    "IconBriefcaseStroke",
]);
export type IconName = z.infer<typeof IconNameSchema>;


export const TypeSchema = z.enum([
    "Business",
    "Creator",
]);
export type Type = z.infer<typeof TypeSchema>;


export const LangSchema = z.enum([
    "en",
    "es",
    "fr",
    "ja",
    "qme",
    "qst",
    "und",
    "zh",
]);
export type Lang = z.infer<typeof LangSchema>;


export const ProfileImageShapeSchema = z.enum([
    "Circle",
]);
export type ProfileImageShape = z.infer<typeof ProfileImageShapeSchema>;


export const PurpleTypenameSchema = z.enum([
    "User",
]);
export type PurpleTypename = z.infer<typeof PurpleTypenameSchema>;


export const StatusSchema = z.enum([
    "Available",
]);
export type Status = z.infer<typeof StatusSchema>;


export const ResizeSchema = z.enum([
    "crop",
    "fit",
]);
export type Resize = z.infer<typeof ResizeSchema>;


export const MediaTypeSchema = z.enum([
    "animated_gif",
    "photo",
    "video",
]);
export type MediaType = z.infer<typeof MediaTypeSchema>;


export const ContentTypeSchema = z.enum([
    "application/x-mpegURL",
    "video/mp4",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;


export const NameSchema = z.enum([
    "BBC News 中文",
    "formaldehyke",
    "Garfielf The Cat",
    "Grok",
    "华英",
    "无性欲",
    "榨干早泄牛",
    "派小派",
]);
export type Name = z.infer<typeof NameSchema>;


export const ScreenNameSchema = z.enum([
    "bbcchinese",
    "csnsaob26",
    "formaldehyke",
    "GarfielfC",
    "grok",
    "huaying25527993",
    "Paixiaopai",
    "xiaogou26",
]);
export type ScreenName = z.infer<typeof ScreenNameSchema>;


export const EligibilitySchema = z.enum([
    "IneligibleNotProfessional",
]);
export type Eligibility = z.infer<typeof EligibilitySchema>;


export const ValueTypeSchema = z.enum([
    "IMAGE",
    "IMAGE_COLOR",
    "STRING",
    "USER",
]);
export type ValueType = z.infer<typeof ValueTypeSchema>;


export const StateSchema = z.enum([
    "Enabled",
    "EnabledWithCount",
]);
export type State = z.infer<typeof StateSchema>;


export const FluffyTypenameSchema = z.enum([
    "Tweet",
    "TweetTombstone",
]);
export type FluffyTypename = z.infer<typeof FluffyTypenameSchema>;


export const InstructionTypeSchema = z.enum([
    "TimelineAddEntries",
    "TimelineClearCache",
    "TimelineTerminateTimeline",
]);
export type InstructionType = z.infer<typeof InstructionTypeSchema>;

export const ConversationDetailsSchema = z.object({
    "conversationSection": ConversationSectionSchema,
});
export type ConversationDetails = z.infer<typeof ConversationDetailsSchema>;

export const TimelinesDetailsSchema = z.object({
    "controllerData": ControllerDataSchema,
});
export type TimelinesDetails = z.infer<typeof TimelinesDetailsSchema>;

export const DisplayTreatmentSchema = z.object({
    "actionText": z.string(),
});
export type DisplayTreatment = z.infer<typeof DisplayTreatmentSchema>;

export const UnmentionDataSchema = z.object({
});
export type UnmentionData = z.infer<typeof UnmentionDataSchema>;

export const AvatarSchema = z.object({
    "image_url": z.string(),
});
export type Avatar = z.infer<typeof AvatarSchema>;

export const FluffyCoreSchema = z.object({
    "created_at": z.string(),
    "name": z.string(),
    "screen_name": z.string(),
});
export type FluffyCore = z.infer<typeof FluffyCoreSchema>;

export const DmPermissionsSchema = z.object({
    "can_dm": z.boolean(),
});
export type DmPermissions = z.infer<typeof DmPermissionsSchema>;

export const UrlSchema = z.object({
    "display_url": z.string(),
    "expanded_url": z.string(),
    "url": z.string(),
    "indices": z.array(z.number()),
});
export type Url = z.infer<typeof UrlSchema>;

export const LocationSchema = z.object({
    "location": z.string(),
});
export type Location = z.infer<typeof LocationSchema>;

export const MediaPermissionsSchema = z.object({
    "can_media_tag": z.boolean(),
});
export type MediaPermissions = z.infer<typeof MediaPermissionsSchema>;

export const PrivacySchema = z.object({
    "protected": z.boolean(),
});
export type Privacy = z.infer<typeof PrivacySchema>;

export const CategorySchema = z.object({
    "id": z.number(),
    "name": z.string(),
    "icon_name": IconNameSchema,
});
export type Category = z.infer<typeof CategorySchema>;

export const ProfileBioSchema = z.object({
    "description": z.string(),
});
export type ProfileBio = z.infer<typeof ProfileBioSchema>;

export const RelationshipPerspectivesSchema = z.object({
    "following": z.boolean(),
});
export type RelationshipPerspectives = z.infer<typeof RelationshipPerspectivesSchema>;

export const PurpleVerificationSchema = z.object({
    "verified": z.boolean(),
});
export type PurpleVerification = z.infer<typeof PurpleVerificationSchema>;

export const EditControlSchema = z.object({
    "edit_tweet_ids": z.array(z.string()),
    "editable_until_msecs": z.string(),
    "is_edit_eligible": z.boolean(),
    "edits_remaining": z.string(),
});
export type EditControl = z.infer<typeof EditControlSchema>;

export const GrokAnnotationsSchema = z.object({
    "is_image_editable_by_grok": z.boolean(),
});
export type GrokAnnotations = z.infer<typeof GrokAnnotationsSchema>;

export const HashtagSchema = z.object({
    "indices": z.array(z.number()),
    "text": z.string(),
});
export type Hashtag = z.infer<typeof HashtagSchema>;

export const AllowDownloadStatusSchema = z.object({
    "allow_download": z.boolean().optional(),
});
export type AllowDownloadStatus = z.infer<typeof AllowDownloadStatusSchema>;

export const ExtMediaAvailabilitySchema = z.object({
    "status": StatusSchema,
});
export type ExtMediaAvailability = z.infer<typeof ExtMediaAvailabilitySchema>;

export const OrigClassSchema = z.object({
    "faces": z.array(z.any()),
});
export type OrigClass = z.infer<typeof OrigClassSchema>;

export const MediaResultsResultSchema = z.object({
    "media_key": z.string(),
});
export type MediaResultsResult = z.infer<typeof MediaResultsResultSchema>;

export const FocusRectSchema = z.object({
    "x": z.number(),
    "y": z.number(),
    "w": z.number(),
    "h": z.number(),
});
export type FocusRect = z.infer<typeof FocusRectSchema>;

export const ThumbClassSchema = z.object({
    "h": z.number(),
    "w": z.number(),
    "resize": ResizeSchema,
});
export type ThumbClass = z.infer<typeof ThumbClassSchema>;

export const VariantSchema = z.object({
    "content_type": ContentTypeSchema,
    "url": z.string(),
    "bitrate": z.number().optional(),
});
export type Variant = z.infer<typeof VariantSchema>;

export const UserMentionSchema = z.object({
    "id_str": z.string(),
    "name": NameSchema,
    "screen_name": ScreenNameSchema,
    "indices": z.array(z.number()),
});
export type UserMention = z.infer<typeof UserMentionSchema>;

export const FluffyAdditionalMediaInfoSchema = z.object({
    "monetizable": z.boolean(),
});
export type FluffyAdditionalMediaInfo = z.infer<typeof FluffyAdditionalMediaInfoSchema>;

export const QuotedStatusPermalinkSchema = z.object({
    "url": z.string(),
    "expanded": z.string(),
    "display": z.string(),
});
export type QuotedStatusPermalink = z.infer<typeof QuotedStatusPermalinkSchema>;

export const HeadlineSchema = z.object({
    "text": z.string(),
    "entities": z.array(z.any()),
});
export type Headline = z.infer<typeof HeadlineSchema>;

export const ResultMediaSchema = z.object({
    "inline_media": z.array(z.any()),
});
export type ResultMedia = z.infer<typeof ResultMediaSchema>;

export const RichtextSchema = z.object({
    "richtext_tags": z.array(z.any()),
});
export type Richtext = z.infer<typeof RichtextSchema>;

export const QuickPromoteEligibilitySchema = z.object({
    "eligibility": EligibilitySchema,
});
export type QuickPromoteEligibility = z.infer<typeof QuickPromoteEligibilitySchema>;

export const RgbSchema = z.object({
    "blue": z.number(),
    "green": z.number(),
    "red": z.number(),
});
export type Rgb = z.infer<typeof RgbSchema>;

export const ImageValueSchema = z.object({
    "height": z.number(),
    "width": z.number(),
    "url": z.string(),
});
export type ImageValue = z.infer<typeof ImageValueSchema>;

export const UserValueSchema = z.object({
    "id_str": z.string(),
    "path": z.array(z.any()),
});
export type UserValue = z.infer<typeof UserValueSchema>;

export const AudienceSchema = z.object({
    "name": z.string(),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const DeviceSchema = z.object({
    "name": z.string(),
    "version": z.string(),
});
export type Device = z.infer<typeof DeviceSchema>;

export const FluffyVerificationSchema = z.object({
    "verified": z.boolean(),
    "verified_type": TypeSchema,
});
export type FluffyVerification = z.infer<typeof FluffyVerificationSchema>;

export const StickyCoreSchema = z.object({
    "screen_name": z.string(),
});
export type StickyCore = z.infer<typeof StickyCoreSchema>;

export const ViewsSchema = z.object({
    "count": z.string().optional(),
    "state": StateSchema,
});
export type Views = z.infer<typeof ViewsSchema>;

export const RefSchema = z.object({
    "type": z.string(),
    "url": z.string(),
    "urlType": z.string(),
});
export type Ref = z.infer<typeof RefSchema>;

export const ConversationMetadataSchema = z.object({
    "allTweetIds": z.array(z.string()),
    "enableDeduplication": z.boolean(),
});
export type ConversationMetadata = z.infer<typeof ConversationMetadataSchema>;

export const ReaderModeConfigSchema = z.object({
    "is_reader_mode_available": z.boolean(),
});
export type ReaderModeConfig = z.infer<typeof ReaderModeConfigSchema>;

export const ScribeConfigSchema = z.object({
    "page": z.string(),
});
export type ScribeConfig = z.infer<typeof ScribeConfigSchema>;

export const DetailsSchema = z.object({
    "conversationDetails": ConversationDetailsSchema,
    "timelinesDetails": TimelinesDetailsSchema,
});
export type Details = z.infer<typeof DetailsSchema>;

export const DescriptionSchema = z.object({
    "urls": z.array(UrlSchema),
});
export type Description = z.infer<typeof DescriptionSchema>;

export const ProfessionalSchema = z.object({
    "rest_id": z.string(),
    "professional_type": TypeSchema,
    "category": z.array(CategorySchema),
});
export type Professional = z.infer<typeof ProfessionalSchema>;

export const FluffyEntitiesSchema = z.object({
    "description": DescriptionSchema,
});
export type FluffyEntities = z.infer<typeof FluffyEntitiesSchema>;

export const FeaturesSchema = z.object({
    "large": OrigClassSchema,
    "medium": OrigClassSchema,
    "small": OrigClassSchema,
    "orig": OrigClassSchema,
});
export type Features = z.infer<typeof FeaturesSchema>;

export const MediaResultsSchema = z.object({
    "result": MediaResultsResultSchema,
});
export type MediaResults = z.infer<typeof MediaResultsSchema>;

export const OriginalInfoSchema = z.object({
    "height": z.number(),
    "width": z.number(),
    "focus_rects": z.array(FocusRectSchema),
});
export type OriginalInfo = z.infer<typeof OriginalInfoSchema>;

export const SizesSchema = z.object({
    "large": ThumbClassSchema,
    "medium": ThumbClassSchema,
    "small": ThumbClassSchema,
    "thumb": ThumbClassSchema,
});
export type Sizes = z.infer<typeof SizesSchema>;

export const VideoInfoSchema = z.object({
    "aspect_ratio": z.array(z.number()),
    "duration_millis": z.number().optional(),
    "variants": z.array(VariantSchema),
});
export type VideoInfo = z.infer<typeof VideoInfoSchema>;

export const PurpleMediaSchema = z.object({
    "display_url": z.string(),
    "expanded_url": z.string(),
    "id_str": z.string(),
    "indices": z.array(z.number()),
    "media_key": z.string(),
    "media_url_https": z.string(),
    "type": MediaTypeSchema,
    "url": z.string(),
    "additional_media_info": FluffyAdditionalMediaInfoSchema.optional(),
    "ext_media_availability": ExtMediaAvailabilitySchema,
    "sizes": SizesSchema,
    "original_info": OriginalInfoSchema,
    "allow_download_status": AllowDownloadStatusSchema.optional(),
    "video_info": VideoInfoSchema.optional(),
    "media_results": MediaResultsSchema,
    "features": FeaturesSchema.optional(),
});
export type PurpleMedia = z.infer<typeof PurpleMediaSchema>;

export const PromptSchema = z.object({
    "__typename": z.string(),
    "cta_type": z.string(),
    "headline": HeadlineSchema,
    "subtext": HeadlineSchema,
});
export type Prompt = z.infer<typeof PromptSchema>;

export const PaletteSchema = z.object({
    "rgb": RgbSchema,
    "percentage": z.number(),
});
export type Palette = z.infer<typeof PaletteSchema>;

export const PlatformSchema = z.object({
    "audience": AudienceSchema,
    "device": DeviceSchema,
});
export type Platform = z.infer<typeof PlatformSchema>;

export const ConversationOwnerResultsResultSchema = z.object({
    "__typename": PurpleTypenameSchema,
    "core": StickyCoreSchema,
});
export type ConversationOwnerResultsResult = z.infer<typeof ConversationOwnerResultsResultSchema>;

export const TentacledMediaSchema = z.object({
    "display_url": z.string(),
    "expanded_url": z.string(),
    "ext_alt_text": z.string().optional(),
    "id_str": z.string(),
    "indices": z.array(z.number()),
    "media_key": z.string(),
    "media_url_https": z.string(),
    "type": MediaTypeSchema,
    "url": z.string(),
    "ext_media_availability": ExtMediaAvailabilitySchema,
    "sizes": SizesSchema,
    "original_info": OriginalInfoSchema,
    "video_info": VideoInfoSchema.optional(),
    "media_results": MediaResultsSchema,
    "additional_media_info": FluffyAdditionalMediaInfoSchema.optional(),
    "allow_download_status": AllowDownloadStatusSchema.optional(),
    "features": FeaturesSchema.optional(),
});
export type TentacledMedia = z.infer<typeof TentacledMediaSchema>;

export const EntitySchema = z.object({
    "fromIndex": z.number(),
    "toIndex": z.number(),
    "ref": RefSchema,
});
export type Entity = z.infer<typeof EntitySchema>;

export const ContentMetadataSchema = z.object({
    "conversationMetadata": ConversationMetadataSchema,
});
export type ContentMetadata = z.infer<typeof ContentMetadataSchema>;

export const ThreadedConversationWithInjectionsV2MetadataSchema = z.object({
    "scribeConfig": ScribeConfigSchema,
    "reader_mode_config": ReaderModeConfigSchema.optional(),
});
export type ThreadedConversationWithInjectionsV2Metadata = z.infer<typeof ThreadedConversationWithInjectionsV2MetadataSchema>;

export const ClientEventInfoSchema = z.object({
    "component": EntSchema,
    "element": EntSchema.optional(),
    "details": DetailsSchema.optional(),
});
export type ClientEventInfo = z.infer<typeof ClientEventInfoSchema>;

export const PurpleEntitiesSchema = z.object({
    "description": DescriptionSchema,
    "url": DescriptionSchema.optional(),
});
export type PurpleEntities = z.infer<typeof PurpleEntitiesSchema>;

export const TentacledLegacySchema = z.object({
    "default_profile": z.boolean(),
    "default_profile_image": z.boolean(),
    "description": z.string(),
    "entities": FluffyEntitiesSchema,
    "fast_followers_count": z.number(),
    "favourites_count": z.number(),
    "followers_count": z.number(),
    "friends_count": z.number(),
    "has_custom_timelines": z.boolean(),
    "is_translator": z.boolean(),
    "listed_count": z.number(),
    "media_count": z.number(),
    "normal_followers_count": z.number(),
    "pinned_tweet_ids_str": z.array(z.string()),
    "possibly_sensitive": z.boolean(),
    "profile_interstitial_type": ProfileInterstitialTypeSchema,
    "statuses_count": z.number(),
    "translator_type": TranslatorTypeSchema,
    "want_retweets": z.boolean(),
    "withheld_in_countries": z.array(z.any()),
});
export type TentacledLegacy = z.infer<typeof TentacledLegacySchema>;

export const PurpleExtendedEntitiesSchema = z.object({
    "media": z.array(PurpleMediaSchema),
});
export type PurpleExtendedEntities = z.infer<typeof PurpleExtendedEntitiesSchema>;

export const LimitedActionSchema = z.object({
    "action": z.string(),
    "prompt": PromptSchema,
});
export type LimitedAction = z.infer<typeof LimitedActionSchema>;

export const ImageColorValueSchema = z.object({
    "palette": z.array(PaletteSchema),
});
export type ImageColorValue = z.infer<typeof ImageColorValueSchema>;

export const CardPlatformSchema = z.object({
    "platform": PlatformSchema,
});
export type CardPlatform = z.infer<typeof CardPlatformSchema>;

export const ConversationOwnerResultsSchema = z.object({
    "result": ConversationOwnerResultsResultSchema,
});
export type ConversationOwnerResults = z.infer<typeof ConversationOwnerResultsSchema>;

export const TentacledExtendedEntitiesSchema = z.object({
    "media": z.array(TentacledMediaSchema),
});
export type TentacledExtendedEntities = z.infer<typeof TentacledExtendedEntitiesSchema>;

export const TextSchema = z.object({
    "rtl": z.boolean(),
    "text": z.string(),
    "entities": z.array(EntitySchema),
});
export type Text = z.infer<typeof TextSchema>;

export const PurpleLegacySchema = z.object({
    "default_profile": z.boolean(),
    "default_profile_image": z.boolean(),
    "description": z.string(),
    "entities": PurpleEntitiesSchema,
    "fast_followers_count": z.number(),
    "favourites_count": z.number(),
    "followers_count": z.number(),
    "friends_count": z.number(),
    "has_custom_timelines": z.boolean(),
    "is_translator": z.boolean(),
    "listed_count": z.number(),
    "media_count": z.number(),
    "normal_followers_count": z.number(),
    "pinned_tweet_ids_str": z.array(z.string()),
    "possibly_sensitive": z.boolean(),
    "profile_banner_url": z.string().optional(),
    "profile_interstitial_type": ProfileInterstitialTypeSchema,
    "statuses_count": z.number(),
    "translator_type": TranslatorTypeSchema,
    "url": z.string().optional(),
    "want_retweets": z.boolean(),
    "withheld_in_countries": z.array(z.any()),
});
export type PurpleLegacy = z.infer<typeof PurpleLegacySchema>;

export const TentacledResultSchema = z.object({
    "__typename": PurpleTypenameSchema,
    "id": z.string(),
    "rest_id": z.string(),
    "affiliates_highlighted_label": UnmentionDataSchema,
    "avatar": AvatarSchema,
    "core": FluffyCoreSchema,
    "dm_permissions": DmPermissionsSchema,
    "follow_request_sent": z.boolean(),
    "has_graduated_access": z.boolean(),
    "is_blue_verified": z.boolean(),
    "legacy": TentacledLegacySchema,
    "location": LocationSchema,
    "media_permissions": MediaPermissionsSchema,
    "parody_commentary_fan_label": ParodyCommentaryFanLabelSchema,
    "profile_image_shape": ProfileImageShapeSchema,
    "profile_bio": ProfileBioSchema,
    "privacy": PrivacySchema,
    "relationship_perspectives": RelationshipPerspectivesSchema,
    "verification": PurpleVerificationSchema,
});
export type TentacledResult = z.infer<typeof TentacledResultSchema>;

export const LimitedActionResultsSchema = z.object({
    "limited_actions": z.array(LimitedActionSchema),
});
export type LimitedActionResults = z.infer<typeof LimitedActionResultsSchema>;

export const ValueSchema = z.object({
    "image_value": ImageValueSchema.optional(),
    "type": ValueTypeSchema,
    "string_value": z.string().optional(),
    "scribe_key": z.string().optional(),
    "user_value": UserValueSchema.optional(),
    "image_color_value": ImageColorValueSchema.optional(),
});
export type Value = z.infer<typeof ValueSchema>;

export const UserRefsResultResultSchema = z.object({
    "__typename": PurpleTypenameSchema,
    "id": z.string(),
    "rest_id": z.string(),
    "affiliates_highlighted_label": UnmentionDataSchema,
    "avatar": AvatarSchema,
    "core": FluffyCoreSchema,
    "dm_permissions": DmPermissionsSchema,
    "follow_request_sent": z.boolean(),
    "has_graduated_access": z.boolean(),
    "is_blue_verified": z.boolean(),
    "legacy": PurpleLegacySchema,
    "location": LocationSchema,
    "media_permissions": MediaPermissionsSchema,
    "parody_commentary_fan_label": ParodyCommentaryFanLabelSchema,
    "profile_image_shape": z.string(),
    "profile_bio": ProfileBioSchema,
    "privacy": PrivacySchema,
    "relationship_perspectives": RelationshipPerspectivesSchema,
    "verification": FluffyVerificationSchema,
    "profile_description_language": LangSchema,
});
export type UserRefsResultResult = z.infer<typeof UserRefsResultResultSchema>;

export const IndigoResultSchema = z.object({
    "__typename": PurpleTypenameSchema,
    "id": z.string(),
    "rest_id": z.string(),
    "affiliates_highlighted_label": UnmentionDataSchema,
    "avatar": AvatarSchema,
    "core": FluffyCoreSchema,
    "dm_permissions": DmPermissionsSchema,
    "follow_request_sent": z.boolean(),
    "has_graduated_access": z.boolean(),
    "is_blue_verified": z.boolean(),
    "legacy": PurpleLegacySchema,
    "location": LocationSchema,
    "media_permissions": MediaPermissionsSchema,
    "parody_commentary_fan_label": ParodyCommentaryFanLabelSchema,
    "profile_image_shape": ProfileImageShapeSchema,
    "profile_bio": ProfileBioSchema,
    "privacy": PrivacySchema,
    "relationship_perspectives": RelationshipPerspectivesSchema,
    "verification": PurpleVerificationSchema,
    "profile_description_language": LangSchema,
});
export type IndigoResult = z.infer<typeof IndigoResultSchema>;

export const ConversationControlSchema = z.object({
    "policy": z.string(),
    "conversation_owner_results": ConversationOwnerResultsSchema,
});
export type ConversationControl = z.infer<typeof ConversationControlSchema>;

export const TombstoneSchema = z.object({
    "__typename": z.string(),
    "text": TextSchema,
});
export type Tombstone = z.infer<typeof TombstoneSchema>;

export const FluffyResultSchema = z.object({
    "__typename": PurpleTypenameSchema,
    "id": z.string(),
    "rest_id": z.string(),
    "affiliates_highlighted_label": UnmentionDataSchema,
    "avatar": AvatarSchema,
    "core": FluffyCoreSchema,
    "dm_permissions": DmPermissionsSchema,
    "follow_request_sent": z.boolean(),
    "has_graduated_access": z.boolean(),
    "is_blue_verified": z.boolean(),
    "legacy": PurpleLegacySchema,
    "location": LocationSchema,
    "media_permissions": MediaPermissionsSchema,
    "parody_commentary_fan_label": ParodyCommentaryFanLabelSchema,
    "profile_image_shape": ProfileImageShapeSchema,
    "professional": ProfessionalSchema.optional(),
    "profile_bio": ProfileBioSchema,
    "privacy": PrivacySchema,
    "relationship_perspectives": RelationshipPerspectivesSchema,
    "verification": PurpleVerificationSchema,
    "profile_description_language": LangSchema.optional(),
});
export type FluffyResult = z.infer<typeof FluffyResultSchema>;

export const SourceUserUserResultsSchema = z.object({
    "result": TentacledResultSchema,
});
export type SourceUserUserResults = z.infer<typeof SourceUserUserResultsSchema>;

export const BindingValueSchema = z.object({
    "key": z.string(),
    "value": ValueSchema,
});
export type BindingValue = z.infer<typeof BindingValueSchema>;

export const UserRefsResultSchema = z.object({
    "result": UserRefsResultResultSchema,
});
export type UserRefsResult = z.infer<typeof UserRefsResultSchema>;

export const FluffyUserResultsSchema = z.object({
    "result": IndigoResultSchema,
});
export type FluffyUserResults = z.infer<typeof FluffyUserResultsSchema>;

export const PurpleUserResultsSchema = z.object({
    "result": FluffyResultSchema,
});
export type PurpleUserResults = z.infer<typeof PurpleUserResultsSchema>;

export const SourceUserClassSchema = z.object({
    "user_results": SourceUserUserResultsSchema,
});
export type SourceUserClass = z.infer<typeof SourceUserClassSchema>;

export const CardLegacySchema = z.object({
    "binding_values": z.array(BindingValueSchema),
    "card_platform": CardPlatformSchema,
    "name": z.string(),
    "url": z.string(),
    "user_refs_results": z.array(UserRefsResultSchema),
});
export type CardLegacy = z.infer<typeof CardLegacySchema>;

export const TentacledCoreSchema = z.object({
    "user_results": FluffyUserResultsSchema,
});
export type TentacledCore = z.infer<typeof TentacledCoreSchema>;

export const PurpleCoreSchema = z.object({
    "user_results": PurpleUserResultsSchema,
});
export type PurpleCore = z.infer<typeof PurpleCoreSchema>;

export const PurpleAdditionalMediaInfoSchema = z.object({
    "monetizable": z.boolean(),
    "source_user": SourceUserClassSchema.optional(),
});
export type PurpleAdditionalMediaInfo = z.infer<typeof PurpleAdditionalMediaInfoSchema>;

export const CardSchema = z.object({
    "rest_id": z.string(),
    "legacy": CardLegacySchema,
});
export type Card = z.infer<typeof CardSchema>;

export const FluffyMediaSchema = z.object({
    "display_url": z.string(),
    "expanded_url": z.string(),
    "id_str": z.string(),
    "indices": z.array(z.number()),
    "media_key": z.string(),
    "media_url_https": z.string(),
    "source_status_id_str": z.string(),
    "source_user_id_str": z.string(),
    "type": MediaTypeSchema,
    "url": z.string(),
    "additional_media_info": PurpleAdditionalMediaInfoSchema,
    "ext_media_availability": ExtMediaAvailabilitySchema,
    "sizes": SizesSchema,
    "original_info": OriginalInfoSchema,
    "allow_download_status": AllowDownloadStatusSchema,
    "video_info": VideoInfoSchema,
    "media_results": MediaResultsSchema,
});
export type FluffyMedia = z.infer<typeof FluffyMediaSchema>;

export const EntitiesMediaSchema = z.object({
    "display_url": z.string(),
    "expanded_url": z.string(),
    "id_str": z.string(),
    "indices": z.array(z.number()),
    "media_key": z.string(),
    "media_url_https": z.string(),
    "type": MediaTypeSchema,
    "url": z.string(),
    "additional_media_info": PurpleAdditionalMediaInfoSchema.optional(),
    "ext_media_availability": ExtMediaAvailabilitySchema,
    "sizes": SizesSchema,
    "original_info": OriginalInfoSchema,
    "allow_download_status": AllowDownloadStatusSchema.optional(),
    "video_info": VideoInfoSchema.optional(),
    "media_results": MediaResultsSchema,
    "features": FeaturesSchema.optional(),
    "source_status_id_str": z.string().optional(),
    "source_user_id_str": z.string().optional(),
    "ext_alt_text": z.string().optional(),
});
export type EntitiesMedia = z.infer<typeof EntitiesMediaSchema>;

export const FluffyExtendedEntitiesSchema = z.object({
    "media": z.array(FluffyMediaSchema),
});
export type FluffyExtendedEntities = z.infer<typeof FluffyExtendedEntitiesSchema>;

export const EntitSchema = z.object({
    "hashtags": z.array(HashtagSchema),
    "media": z.array(EntitiesMediaSchema).optional(),
    "symbols": z.array(z.any()),
    "timestamps": z.array(z.any()),
    "urls": z.array(UrlSchema),
    "user_mentions": z.array(UserMentionSchema),
});
export type Entit = z.infer<typeof EntitSchema>;

export const NoteTweetResultsResultSchema = z.object({
    "id": z.string(),
    "text": z.string(),
    "entity_set": EntitSchema,
    "richtext": RichtextSchema,
    "media": ResultMediaSchema,
});
export type NoteTweetResultsResult = z.infer<typeof NoteTweetResultsResultSchema>;

export const StickyLegacySchema = z.object({
    "bookmark_count": z.number(),
    "bookmarked": z.boolean(),
    "created_at": z.string(),
    "conversation_id_str": z.string(),
    "display_text_range": z.array(z.number()),
    "entities": EntitSchema,
    "favorite_count": z.number(),
    "favorited": z.boolean(),
    "full_text": z.string(),
    "is_quote_status": z.boolean(),
    "lang": z.string(),
    "possibly_sensitive": z.boolean().optional(),
    "possibly_sensitive_editable": z.boolean().optional(),
    "quote_count": z.number(),
    "reply_count": z.number(),
    "retweet_count": z.number(),
    "retweeted": z.boolean(),
    "user_id_str": z.string(),
    "id_str": z.string(),
    "conversation_control": ConversationControlSchema.optional(),
});
export type StickyLegacy = z.infer<typeof StickyLegacySchema>;

export const IndigoLegacySchema = z.object({
    "bookmark_count": z.number(),
    "bookmarked": z.boolean(),
    "created_at": z.string(),
    "conversation_control": ConversationControlSchema,
    "conversation_id_str": z.string(),
    "display_text_range": z.array(z.number()),
    "entities": EntitSchema,
    "extended_entities": FluffyExtendedEntitiesSchema,
    "favorite_count": z.number(),
    "favorited": z.boolean(),
    "full_text": z.string(),
    "is_quote_status": z.boolean(),
    "lang": LangSchema,
    "possibly_sensitive": z.boolean(),
    "possibly_sensitive_editable": z.boolean(),
    "quote_count": z.number(),
    "quoted_status_id_str": z.string(),
    "quoted_status_permalink": QuotedStatusPermalinkSchema,
    "reply_count": z.number(),
    "retweet_count": z.number(),
    "retweeted": z.boolean(),
    "user_id_str": z.string(),
    "id_str": z.string(),
});
export type IndigoLegacy = z.infer<typeof IndigoLegacySchema>;

export const FluffyTweetSchema = z.object({
    "rest_id": z.string(),
    "has_birdwatch_notes": z.boolean(),
    "core": SourceUserClassSchema,
    "unmention_data": UnmentionDataSchema,
    "edit_control": EditControlSchema,
    "is_translatable": z.boolean(),
    "views": ViewsSchema,
    "source": z.string(),
    "grok_analysis_button": z.boolean(),
    "legacy": StickyLegacySchema,
});
export type FluffyTweet = z.infer<typeof FluffyTweetSchema>;

export const IndecentLegacySchema = z.object({
    "bookmark_count": z.number(),
    "bookmarked": z.boolean(),
    "created_at": z.string(),
    "conversation_id_str": z.string(),
    "display_text_range": z.array(z.number()),
    "entities": EntitSchema,
    "favorite_count": z.number(),
    "favorited": z.boolean(),
    "full_text": z.string(),
    "in_reply_to_screen_name": ScreenNameSchema,
    "in_reply_to_status_id_str": z.string(),
    "in_reply_to_user_id_str": z.string(),
    "is_quote_status": z.boolean(),
    "lang": LangSchema,
    "quote_count": z.number(),
    "reply_count": z.number(),
    "retweet_count": z.number(),
    "retweeted": z.boolean(),
    "user_id_str": z.string(),
    "id_str": z.string(),
    "extended_entities": TentacledExtendedEntitiesSchema.optional(),
    "possibly_sensitive": z.boolean().optional(),
    "possibly_sensitive_editable": z.boolean().optional(),
});
export type IndecentLegacy = z.infer<typeof IndecentLegacySchema>;

export const FluffyLegacySchema = z.object({
    "bookmark_count": z.number(),
    "bookmarked": z.boolean(),
    "created_at": z.string(),
    "conversation_id_str": z.string(),
    "display_text_range": z.array(z.number()),
    "entities": EntitSchema,
    "extended_entities": PurpleExtendedEntitiesSchema,
    "favorite_count": z.number(),
    "favorited": z.boolean(),
    "full_text": z.string(),
    "is_quote_status": z.boolean(),
    "lang": z.string(),
    "possibly_sensitive": z.boolean(),
    "possibly_sensitive_editable": z.boolean(),
    "quote_count": z.number(),
    "reply_count": z.number(),
    "retweet_count": z.number(),
    "retweeted": z.boolean(),
    "user_id_str": z.string(),
    "id_str": z.string(),
    "quoted_status_id_str": z.string().optional(),
    "quoted_status_permalink": QuotedStatusPermalinkSchema.optional(),
});
export type FluffyLegacy = z.infer<typeof FluffyLegacySchema>;

export const NoteTweetResultsSchema = z.object({
    "result": NoteTweetResultsResultSchema,
});
export type NoteTweetResults = z.infer<typeof NoteTweetResultsSchema>;

export const StickyResultSchema = z.object({
    "__typename": TweetDisplayTypeSchema,
    "rest_id": z.string(),
    "has_birdwatch_notes": z.boolean(),
    "core": TentacledCoreSchema,
    "card": CardSchema,
    "unmention_data": UnmentionDataSchema,
    "edit_control": EditControlSchema,
    "is_translatable": z.boolean(),
    "views": ViewsSchema,
    "source": z.string(),
    "grok_analysis_button": z.boolean(),
    "legacy": StickyLegacySchema,
});
export type StickyResult = z.infer<typeof StickyResultSchema>;

export const IndecentResultSchema = z.object({
    "__typename": z.string(),
    "tweet": FluffyTweetSchema,
    "limitedActionResults": LimitedActionResultsSchema,
});
export type IndecentResult = z.infer<typeof IndecentResultSchema>;

export const HilariousResultSchema = z.object({
    "__typename": FluffyTypenameSchema,
    "rest_id": z.string().optional(),
    "has_birdwatch_notes": z.boolean().optional(),
    "core": PurpleCoreSchema.optional(),
    "unmention_data": UnmentionDataSchema.optional(),
    "edit_control": EditControlSchema.optional(),
    "is_translatable": z.boolean().optional(),
    "views": ViewsSchema.optional(),
    "source": z.string().optional(),
    "grok_analysis_button": z.boolean().optional(),
    "legacy": IndecentLegacySchema.optional(),
    "quick_promote_eligibility": QuickPromoteEligibilitySchema.optional(),
    "grok_annotations": UnmentionDataSchema.optional(),
    "tombstone": TombstoneSchema.optional(),
});
export type HilariousResult = z.infer<typeof HilariousResultSchema>;

export const NoteTweetSchema = z.object({
    "is_expandable": z.boolean(),
    "note_tweet_results": NoteTweetResultsSchema,
});
export type NoteTweet = z.infer<typeof NoteTweetSchema>;

export const ResultQuotedStatusResultSchema = z.object({
    "result": StickyResultSchema,
});
export type ResultQuotedStatusResult = z.infer<typeof ResultQuotedStatusResultSchema>;

export const TweetQuotedStatusResultSchema = z.object({
    "result": IndecentResultSchema,
});
export type TweetQuotedStatusResult = z.infer<typeof TweetQuotedStatusResultSchema>;

export const FluffyTweetResultsSchema = z.object({
    "result": HilariousResultSchema,
});
export type FluffyTweetResults = z.infer<typeof FluffyTweetResultsSchema>;

export const PurpleTweetSchema = z.object({
    "rest_id": z.string(),
    "has_birdwatch_notes": z.boolean(),
    "core": SourceUserClassSchema,
    "unmention_data": UnmentionDataSchema,
    "edit_control": EditControlSchema,
    "is_translatable": z.boolean(),
    "views": ViewsSchema,
    "source": z.string(),
    "grok_analysis_button": z.boolean(),
    "quoted_status_result": TweetQuotedStatusResultSchema,
    "legacy": IndigoLegacySchema,
    "quick_promote_eligibility": QuickPromoteEligibilitySchema,
    "grok_annotations": GrokAnnotationsSchema,
});
export type PurpleTweet = z.infer<typeof PurpleTweetSchema>;

export const ItemItemContentSchema = z.object({
    "itemType": ItemTypeEnumSchema,
    "__typename": ItemTypeEnumSchema,
    "tweet_results": FluffyTweetResultsSchema,
    "tweetDisplayType": TweetDisplayTypeSchema,
});
export type ItemItemContent = z.infer<typeof ItemItemContentSchema>;

export const PurpleResultSchema = z.object({
    "__typename": z.string(),
    "rest_id": z.string().optional(),
    "has_birdwatch_notes": z.boolean().optional(),
    "core": PurpleCoreSchema.optional(),
    "unmention_data": UnmentionDataSchema.optional(),
    "edit_control": EditControlSchema.optional(),
    "is_translatable": z.boolean().optional(),
    "views": ViewsSchema.optional(),
    "source": z.string().optional(),
    "grok_analysis_button": z.boolean().optional(),
    "legacy": FluffyLegacySchema.optional(),
    "quick_promote_eligibility": QuickPromoteEligibilitySchema.optional(),
    "grok_annotations": GrokAnnotationsSchema.optional(),
    "quoted_status_result": ResultQuotedStatusResultSchema.optional(),
    "note_tweet": NoteTweetSchema.optional(),
    "tweet": PurpleTweetSchema.optional(),
    "limitedActionResults": LimitedActionResultsSchema.optional(),
});
export type PurpleResult = z.infer<typeof PurpleResultSchema>;

export const ItemItemSchema = z.object({
    "itemContent": ItemItemContentSchema,
    "clientEventInfo": ClientEventInfoSchema,
});
export type ItemItem = z.infer<typeof ItemItemSchema>;

export const PurpleTweetResultsSchema = z.object({
    "result": PurpleResultSchema,
});
export type PurpleTweetResults = z.infer<typeof PurpleTweetResultsSchema>;

export const ItemElementSchema = z.object({
    "entryId": z.string(),
    "item": ItemItemSchema,
});
export type ItemElement = z.infer<typeof ItemElementSchema>;

export const ContentItemContentSchema = z.object({
    "itemType": ItemTypeEnumSchema,
    "__typename": ItemTypeEnumSchema,
    "tweet_results": PurpleTweetResultsSchema,
    "tweetDisplayType": TweetDisplayTypeSchema,
});
export type ContentItemContent = z.infer<typeof ContentItemContentSchema>;

export const ContentSchema = z.object({
    "entryType": EntryTypeEnumSchema,
    "__typename": EntryTypeEnumSchema,
    "itemContent": ContentItemContentSchema.optional(),
    "clientEventInfo": ClientEventInfoSchema.optional(),
    "value": z.string().optional(),
    "cursorType": z.string().optional(),
    "items": z.array(ItemElementSchema).optional(),
    "metadata": ContentMetadataSchema.optional(),
    "displayType": DisplayTypeSchema.optional(),
    "displayTreatment": DisplayTreatmentSchema.optional(),
});
export type Content = z.infer<typeof ContentSchema>;

export const EntrySchema = z.object({
    "entryId": z.string(),
    "sortIndex": z.string(),
    "content": ContentSchema,
});
export type Entry = z.infer<typeof EntrySchema>;

export const InstructionSchema = z.object({
    "type": InstructionTypeSchema,
    "entries": z.array(EntrySchema).optional(),
    "direction": DirectionSchema.optional(),
});
export type Instruction = z.infer<typeof InstructionSchema>;

export const ThreadedConversationWithInjectionsV2Schema = z.object({
    "instructions": z.array(InstructionSchema),
    "metadata": ThreadedConversationWithInjectionsV2MetadataSchema,
});
export type ThreadedConversationWithInjectionsV2 = z.infer<typeof ThreadedConversationWithInjectionsV2Schema>;

export const DataSchema = z.object({
    "threaded_conversation_with_injections_v2": ThreadedConversationWithInjectionsV2Schema,
});
export type Data = z.infer<typeof DataSchema>;

export const TweetDetailResponseSchema = z.object({
    "data": DataSchema,
});
export type TweetDetailResponse = z.infer<typeof TweetDetailResponseSchema>;
