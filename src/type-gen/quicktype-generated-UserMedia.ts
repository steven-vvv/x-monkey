export interface QuicktypeGeneratedUserMedia {
    data: Data;
}

export interface Data {
    user: User;
}

export interface User {
    result: UserResult;
}

export interface UserResult {
    __typename: PurpleTypename;
    timeline:   ResultTimeline;
}

export enum PurpleTypename {
    User = "User",
}

export interface ResultTimeline {
    timeline: TimelineTimeline;
}

export interface TimelineTimeline {
    instructions: Instruction[];
    metadata:     Metadata;
}

export interface Instruction {
    type:           InstructionType;
    moduleItems?:   ModuleItem[];
    moduleEntryId?: ModuleEntryID;
    entries?:       Entry[];
    direction?:     Direction;
}

export enum Direction {
    Bottom = "Bottom",
    Top = "Top",
}

export interface Entry {
    entryId:   string;
    sortIndex: string;
    content:   Content;
}

export interface Content {
    entryType:        EntryTypeEnum;
    __typename:       EntryTypeEnum;
    value?:           string;
    cursorType?:      Direction;
    items?:           ItemElement[];
    displayType?:     string;
    clientEventInfo?: ClientEventInfo;
}

export enum EntryTypeEnum {
    TimelineTimelineCursor = "TimelineTimelineCursor",
    TimelineTimelineModule = "TimelineTimelineModule",
}

export interface ClientEventInfo {
    component: string;
}

export interface ItemElement {
    entryId: string;
    item:    ItemItem;
}

export interface ItemItem {
    itemContent: PurpleItemContent;
}

export interface PurpleItemContent {
    itemType:         ItemTypeEnum;
    __typename:       ItemTypeEnum;
    tweet_results:    PurpleTweetResults;
    tweetDisplayType: TweetDisplayType;
}

export enum ItemTypeEnum {
    TimelineTweet = "TimelineTweet",
}

export enum TweetDisplayType {
    MediaGrid = "MediaGrid",
}

export interface PurpleTweetResults {
    result: PurpleResult;
}

export interface PurpleResult {
    __typename:                              FluffyTypename;
    rest_id:                                 string;
    core:                                    PurpleCore;
    unmention_data:                          UnmentionData;
    edit_control:                            PurpleEditControl;
    is_translatable:                         boolean;
    views:                                   Views;
    source:                                  string;
    grok_translated_post_with_availability?: GrokTranslatedPostWithAvailability;
    grok_analysis_button:                    boolean;
    legacy:                                  FluffyLegacy;
    grok_annotations:                        GrokAnnotations;
    previous_counts?:                        PreviousCounts;
    note_tweet?:                             NoteTweet;
    quoted_status_result?:                   PurpleQuotedStatusResult;
}

export enum FluffyTypename {
    Tweet = "Tweet",
    TweetWithVisibilityResults = "TweetWithVisibilityResults",
}

export interface PurpleCore {
    user_results: PurpleUserResults;
}

export interface PurpleUserResults {
    result: FluffyResult;
}

export interface FluffyResult {
    __typename:                   PurpleTypename;
    id:                           ID;
    rest_id:                      string;
    affiliates_highlighted_label: UnmentionData;
    avatar:                       Avatar;
    core:                         FluffyCore;
    dm_permissions:               DmPermissions;
    follow_request_sent:          boolean;
    has_graduated_access:         boolean;
    is_blue_verified:             boolean;
    legacy:                       PurpleLegacy;
    location:                     LocationClass;
    media_permissions:            MediaPermissions;
    parody_commentary_fan_label:  ParodyCommentaryFanLabel;
    profile_image_shape:          ProfileImageShape;
    professional?:                Professional;
    profile_bio:                  ProfileBio;
    privacy:                      Privacy;
    relationship_perspectives:    PurpleRelationshipPerspectives;
    verification:                 PurpleVerification;
    profile_description_language: PurpleLang;
    super_follow_eligible?:       boolean;
    super_followed_by?:           boolean;
    super_following?:             boolean;
}

export interface UnmentionData {
}

export interface Avatar {
    image_url: string;
}

export interface FluffyCore {
    created_at:  CreatedAt;
    name:        CoreName;
    screen_name: ScreenName;
}

export enum CreatedAt {
    FriAPR1717582800002009 = "Fri Apr 17 17:58:28 +0000 2009",
    FriFeb2317463800002007 = "Fri Feb 23 17:46:38 +0000 2007",
    MonDEC1215123900002022 = "Mon Dec 12 15:12:39 +0000 2022",
    MonNov3018594500002020 = "Mon Nov 30 18:59:45 +0000 2020",
    SunJul1113414500002010 = "Sun Jul 11 13:41:45 +0000 2010",
    ThuDEC2117170900002023 = "Thu Dec 21 17:17:09 +0000 2023",
    ThuJun2804130800002007 = "Thu Jun 28 04:13:08 +0000 2007",
    TueMar2702443000002007 = "Tue Mar 27 02:44:30 +0000 2007",
    TueNov1321434600002007 = "Tue Nov 13 21:43:46 +0000 2007",
    WedMar0716091700002012 = "Wed Mar 07 16:09:17 +0000 2012",
    WedMay1102085200002011 = "Wed May 11 02:08:52 +0000 2011",
}

export enum CoreName {
    BBCNews中文 = "BBC News 中文",
    CelsoMartinho = "Celso Martinho",
    Cloudflare = "Cloudflare",
    Shu = "Shu",
    VercelDevelopers = "Vercel Developers",
    Viking = "Viking",
    YouTube = "YouTube",
    是可乐吖 = "是可乐吖",
    空空狞猫世界第一可爱 = "空空 \ud83c\udf1f 狞猫世界第一可爱！",
    范凯说AIAIInsights = "范凯说 AI | AI Insights",
    蓝点网 = "蓝点网",
}

export enum ScreenName {
    Bbcchinese = "bbcchinese",
    Celso = "celso",
    Cloudflare = "Cloudflare",
    Landiantech = "landiantech",
    Robbinfan = "robbinfan",
    SRamirez97210 = "SRamirez97210",
    Shuding = "shuding",
    SolitudeSola = "Solitude_Sola",
    VercelDev = "vercel_dev",
    Vikingmute = "vikingmute",
    YouTube = "YouTube",
}

export interface DmPermissions {
    can_dm: boolean;
}

export enum ID {
    VXNlcjo3MTI0Njcy = "VXNlcjo3MTI0Njcy",
    VXNlcjo3OTExOTc = "VXNlcjo3OTExOTc=",
    VXNlcjoxNjAyMzIwNDc3MzQ3MDAwMzI1 = "VXNlcjoxNjAyMzIwNDc3MzQ3MDAwMzI1",
    VXNlcjoxNjU0MDc4NzE = "VXNlcjoxNjU0MDc4NzE=",
    VXNlcjoxNzM3ODg0ODY5NjY0MDc5ODc0 = "VXNlcjoxNzM3ODg0ODY5NjY0MDc5ODc0",
    VXNlcjoyOTY1OTM5MTk = "VXNlcjoyOTY1OTM5MTk=",
}

export interface PurpleLegacy {
    default_profile:           boolean;
    default_profile_image:     boolean;
    description:               string;
    entities:                  Entities;
    fast_followers_count:      number;
    favourites_count:          number;
    followers_count:           number;
    friends_count:             number;
    has_custom_timelines:      boolean;
    is_translator:             boolean;
    listed_count:              number;
    media_count:               number;
    normal_followers_count:    number;
    pinned_tweet_ids_str:      string[];
    possibly_sensitive:        boolean;
    profile_interstitial_type: ProfileInterstitialType;
    statuses_count:            number;
    translator_type:           TranslatorType;
    url?:                      string;
    want_retweets:             boolean;
    withheld_in_countries:     any[];
    profile_banner_url?:       string;
    follow_request_sent?:      boolean;
    notifications?:            boolean;
}

export interface Entities {
    description: Description;
    url?:        Description;
}

export interface Description {
    urls: URLElement[];
}

export interface URLElement {
    display_url:  string;
    expanded_url: string;
    url:          string;
    indices:      number[];
}

export enum ProfileInterstitialType {
    Empty = "",
    SensitiveMedia = "sensitive_media",
}

export enum TranslatorType {
    None = "none",
    Regular = "regular",
}

export interface LocationClass {
    location: LocationEnum;
}

export enum LocationEnum {
    Empty = "",
    HongKong = "Hong Kong ",
    LisbonPortugal = "Lisbon, Portugal",
    LondonUK = "London, UK",
    SANBrunoCA = "San Bruno, CA",
    SANFranciscoGlobal = "San Francisco & Global",
    Shanghai = "Shanghai",
    The300CitiesIn100Countries = "300+ cities in 100+ countries",
    土卫六 = "土卫六",
    投身之所 = "投身之所",
}

export interface MediaPermissions {
    can_media_tag: boolean;
}

export enum ParodyCommentaryFanLabel {
    None = "None",
}

export interface Privacy {
    protected: boolean;
}

export interface Professional {
    rest_id:           string;
    professional_type: Type;
    category:          Category[];
}

export interface Category {
    id:        number;
    name:      CategoryName;
    icon_name: IconName;
}

export enum IconName {
    IconBriefcaseStroke = "IconBriefcaseStroke",
}

export enum CategoryName {
    ScienceTechnology = "Science & Technology",
    TechnologySecurityCompany = "Technology-Security Company",
    媒体和新闻公司 = "媒体和新闻公司",
}

export enum Type {
    Business = "Business",
    Creator = "Creator",
}

export interface ProfileBio {
    description: string;
}

export enum PurpleLang {
    In = "in",
    Ja = "ja",
    Zh = "zh",
}

export enum ProfileImageShape {
    Circle = "Circle",
    Square = "Square",
}

export interface PurpleRelationshipPerspectives {
    following:    boolean;
    blocked_by?:  boolean;
    blocking?:    boolean;
    followed_by?: boolean;
    muting?:      boolean;
}

export interface PurpleVerification {
    verified: boolean;
}

export interface PurpleEditControl {
    edit_tweet_ids?:       string[];
    editable_until_msecs?: string;
    is_edit_eligible?:     boolean;
    edits_remaining?:      string;
    initial_tweet_id?:     string;
    edit_control_initial?: EditControlInitialClass;
}

export interface EditControlInitialClass {
    edit_tweet_ids:       string[];
    editable_until_msecs: string;
    is_edit_eligible:     boolean;
    edits_remaining:      string;
}

export interface GrokAnnotations {
    is_image_editable_by_grok?: boolean;
}

export interface GrokTranslatedPostWithAvailability {
    is_available: boolean;
}

export interface FluffyLegacy {
    bookmark_count:              number;
    bookmarked:                  boolean;
    created_at:                  string;
    conversation_id_str:         string;
    display_text_range:          number[];
    entities:                    Entit;
    extended_entities:           PurpleExtendedEntities;
    favorite_count:              number;
    favorited:                   boolean;
    full_text:                   string;
    is_quote_status:             boolean;
    lang:                        PurpleLang;
    possibly_sensitive:          boolean;
    possibly_sensitive_editable: boolean;
    quote_count:                 number;
    reply_count:                 number;
    retweet_count:               number;
    retweeted:                   boolean;
    user_id_str:                 string;
    id_str:                      string;
    in_reply_to_screen_name?:    string;
    in_reply_to_status_id_str?:  string;
    in_reply_to_user_id_str?:    string;
    quoted_status_id_str?:       string;
    quoted_status_permalink?:    QuotedStatusPermalink;
}

export interface Entit {
    hashtags:      Hashtag[];
    media?:        EntitiesMedia[];
    symbols:       any[];
    timestamps?:   any[];
    urls:          URLElement[];
    user_mentions: UserMention[];
}

export interface Hashtag {
    indices: number[];
    text:    string;
}

export interface EntitiesMedia {
    display_url:            string;
    expanded_url:           string;
    id_str:                 string;
    indices:                number[];
    media_key:              string;
    media_url_https:        string;
    type:                   MediaType;
    url:                    string;
    ext_media_availability: EXTMediaAvailability;
    features?:              Features;
    sizes:                  Sizes;
    original_info:          OriginalInfo;
    media_results:          MediaResults;
    allow_download_status?: AllowDownloadStatus;
    additional_media_info?: PurpleAdditionalMediaInfo;
    video_info?:            VideoInfo;
}

export interface PurpleAdditionalMediaInfo {
    monetizable:  boolean;
    title?:       string;
    description?: string;
    embeddable?:  boolean;
}

export interface AllowDownloadStatus {
    allow_download?: boolean;
}

export interface EXTMediaAvailability {
    status: Status;
}

export enum Status {
    Available = "Available",
}

export interface Features {
    large:  OrigClass;
    medium: OrigClass;
    small:  OrigClass;
    orig:   OrigClass;
}

export interface OrigClass {
    faces: FocusRect[];
}

export interface FocusRect {
    x: number;
    y: number;
    h: number;
    w: number;
}

export interface MediaResults {
    result: MediaResultsResult;
}

export interface MediaResultsResult {
    media_key: string;
}

export interface OriginalInfo {
    height:      number;
    width:       number;
    focus_rects: FocusRect[];
}

export interface Sizes {
    large:  ThumbClass;
    medium: ThumbClass;
    small:  ThumbClass;
    thumb:  ThumbClass;
}

export interface ThumbClass {
    h:      number;
    w:      number;
    resize: Resize;
}

export enum Resize {
    Crop = "crop",
    Fit = "fit",
}

export enum MediaType {
    Photo = "photo",
    Video = "video",
}

export interface VideoInfo {
    aspect_ratio:    number[];
    duration_millis: number;
    variants:        Variant[];
}

export interface Variant {
    content_type: ContentType;
    url:          string;
    bitrate?:     number;
}

export enum ContentType {
    ApplicationXMPEGURL = "application/x-mpegURL",
    VideoMp4 = "video/mp4",
}

export interface UserMention {
    id_str:      string;
    name:        string;
    screen_name: string;
    indices:     number[];
}

export interface PurpleExtendedEntities {
    media: PurpleMedia[];
}

export interface PurpleMedia {
    display_url:            string;
    expanded_url:           string;
    id_str:                 string;
    indices:                number[];
    media_key:              string;
    media_url_https:        string;
    type:                   MediaType;
    url:                    string;
    ext_media_availability: EXTMediaAvailability;
    features?:              Features;
    sizes:                  Sizes;
    original_info:          OriginalInfo;
    media_results:          MediaResults;
    allow_download_status?: AllowDownloadStatus;
    additional_media_info?: FluffyAdditionalMediaInfo;
    video_info?:            VideoInfo;
}

export interface FluffyAdditionalMediaInfo {
    monetizable: boolean;
}

export interface QuotedStatusPermalink {
    url:      string;
    expanded: string;
    display:  string;
}

export interface NoteTweet {
    is_expandable:      boolean;
    note_tweet_results: NoteTweetResults;
}

export interface NoteTweetResults {
    result: NoteTweetResultsResult;
}

export interface NoteTweetResultsResult {
    id:         string;
    text:       string;
    entity_set: Entit;
    richtext?:  Richtext;
    media?:     ResultMedia;
}

export interface ResultMedia {
    inline_media: any[];
}

export interface Richtext {
    richtext_tags: RichtextTag[];
}

export interface RichtextTag {
    from_index:     number;
    richtext_types: string[];
    to_index:       number;
}

export interface PreviousCounts {
    bookmark_count: number;
    favorite_count: number;
    quote_count:    number;
    reply_count:    number;
    retweet_count:  number;
}

export interface PurpleQuotedStatusResult {
    result: TentacledResult;
}

export interface TentacledResult {
    __typename:                             FluffyTypename;
    rest_id:                                string;
    core:                                   TentacledCore;
    card?:                                  PurpleCard;
    unmention_data:                         UnmentionData;
    edit_control:                           EditControlInitialClass;
    is_translatable:                        boolean;
    views:                                  Views;
    source:                                 string;
    grok_translated_post_with_availability: GrokTranslatedPostWithAvailability;
    grok_analysis_button:                   boolean;
    legacy:                                 TweetLegacy;
    note_tweet?:                            NoteTweet;
}

export interface PurpleCard {
    rest_id: string;
    legacy:  TentacledLegacy;
}

export interface TentacledLegacy {
    binding_values:    BindingValue[];
    card_platform:     CardPlatform;
    name:              string;
    url:               string;
    user_refs_results: UserRe[];
}

export interface BindingValue {
    key:   string;
    value: Value;
}

export interface Value {
    image_value?:       ImageValue;
    type:               ValueType;
    string_value?:      string;
    scribe_key?:        string;
    user_value?:        UserValue;
    image_color_value?: ImageColorValue;
}

export interface ImageColorValue {
    palette: Palette[];
}

export interface Palette {
    rgb:        RGB;
    percentage: number;
}

export interface RGB {
    blue:  number;
    green: number;
    red:   number;
}

export interface ImageValue {
    height: number;
    width:  number;
    url:    string;
}

export enum ValueType {
    Image = "IMAGE",
    ImageColor = "IMAGE_COLOR",
    String = "STRING",
    User = "USER",
}

export interface UserValue {
    id_str: string;
    path:   any[];
}

export interface CardPlatform {
    platform: Platform;
}

export interface Platform {
    audience: Audience;
    device:   Device;
}

export interface Audience {
    name: string;
}

export interface Device {
    name:    string;
    version: string;
}

export interface UserRe {
    result: StickyResult;
}

export interface StickyResult {
    __typename:                   PurpleTypename;
    id:                           string;
    rest_id:                      string;
    affiliates_highlighted_label: UnmentionData;
    avatar:                       Avatar;
    core:                         FluffyCore;
    dm_permissions:               DmPermissions;
    follow_request_sent:          boolean;
    has_graduated_access:         boolean;
    is_blue_verified:             boolean;
    legacy:                       PurpleLegacy;
    location:                     LocationClass;
    media_permissions:            MediaPermissions;
    parody_commentary_fan_label:  ParodyCommentaryFanLabel;
    profile_image_shape:          ProfileImageShape;
    profile_bio:                  ProfileBio;
    privacy:                      Privacy;
    relationship_perspectives:    FluffyRelationshipPerspectives;
    verification:                 FluffyVerification;
    profile_description_language: FluffyLang;
    professional?:                Professional;
}

export enum FluffyLang {
    En = "en",
    Lt = "lt",
    Zh = "zh",
}

export interface FluffyRelationshipPerspectives {
    following: boolean;
}

export interface FluffyVerification {
    verified:       boolean;
    verified_type?: Type;
}

export interface TentacledCore {
    user_results: UserRe;
}

export interface TweetLegacy {
    bookmark_count:               number;
    bookmarked:                   boolean;
    created_at:                   string;
    conversation_id_str:          string;
    display_text_range:           number[];
    entities:                     Entit;
    favorite_count:               number;
    favorited:                    boolean;
    full_text:                    string;
    is_quote_status:              boolean;
    lang:                         FluffyLang;
    possibly_sensitive?:          boolean;
    possibly_sensitive_editable?: boolean;
    quote_count:                  number;
    reply_count:                  number;
    retweet_count:                number;
    retweeted:                    boolean;
    user_id_str:                  string;
    id_str:                       string;
    extended_entities?:           PurpleExtendedEntities;
}

export interface Views {
    count: string;
    state: State;
}

export enum State {
    EnabledWithCount = "EnabledWithCount",
}

export enum ModuleEntryID {
    ProfileGrid0 = "profile-grid-0",
}

export interface ModuleItem {
    entryId: string;
    item:    ModuleItemItem;
}

export interface ModuleItemItem {
    itemContent: FluffyItemContent;
}

export interface FluffyItemContent {
    itemType:         ItemTypeEnum;
    __typename:       ItemTypeEnum;
    tweet_results:    FluffyTweetResults;
    tweetDisplayType: TweetDisplayType;
}

export interface FluffyTweetResults {
    result: IndigoResult;
}

export interface IndigoResult {
    __typename:                              FluffyTypename;
    rest_id?:                                string;
    core?:                                   PurpleCore;
    unmention_data?:                         UnmentionData;
    edit_control?:                           PurpleEditControl;
    is_translatable?:                        boolean;
    views?:                                  Views;
    source?:                                 string;
    note_tweet?:                             NoteTweet;
    grok_translated_post_with_availability?: GrokTranslatedPostWithAvailability;
    grok_analysis_button?:                   boolean;
    quoted_status_result?:                   FluffyQuotedStatusResult;
    legacy?:                                 IndigoLegacy;
    grok_annotations?:                       GrokAnnotations;
    previous_counts?:                        PreviousCounts;
    card?:                                   FluffyCard;
    tweet?:                                  Tweet;
    mediaVisibilityResults?:                 MediaVisibilityResults;
}

export interface FluffyCard {
    rest_id: string;
    legacy:  StickyLegacy;
}

export interface StickyLegacy {
    binding_values:    BindingValue[];
    card_platform:     CardPlatform;
    name:              string;
    url:               string;
    user_refs_results: UserRefsResult[];
}

export interface UserRefsResult {
    result: IndecentResult;
}

export interface IndecentResult {
    __typename:                   PurpleTypename;
    id:                           string;
    rest_id:                      string;
    affiliates_highlighted_label: UnmentionData;
    avatar:                       Avatar;
    core:                         FluffyCore;
    dm_permissions:               DmPermissions;
    follow_request_sent:          boolean;
    has_graduated_access:         boolean;
    is_blue_verified:             boolean;
    legacy:                       PurpleLegacy;
    location:                     LocationClass;
    media_permissions:            MediaPermissions;
    parody_commentary_fan_label:  ParodyCommentaryFanLabel;
    profile_image_shape:          ProfileImageShape;
    profile_bio:                  ProfileBio;
    privacy:                      Privacy;
    relationship_perspectives:    FluffyRelationshipPerspectives;
    verification:                 FluffyVerification;
    profile_description_language: FluffyLang;
}

export interface IndigoLegacy {
    bookmark_count:              number;
    bookmarked:                  boolean;
    created_at:                  string;
    conversation_id_str:         string;
    display_text_range:          number[];
    entities:                    Entit;
    extended_entities?:          FluffyExtendedEntities;
    favorite_count:              number;
    favorited:                   boolean;
    full_text:                   string;
    is_quote_status:             boolean;
    lang:                        PurpleLang;
    possibly_sensitive:          boolean;
    possibly_sensitive_editable: boolean;
    quote_count:                 number;
    quoted_status_id_str?:       string;
    quoted_status_permalink?:    QuotedStatusPermalink;
    reply_count:                 number;
    retweet_count:               number;
    retweeted:                   boolean;
    user_id_str:                 string;
    id_str:                      string;
    in_reply_to_screen_name?:    string;
    in_reply_to_status_id_str?:  string;
    in_reply_to_user_id_str?:    string;
}

export interface FluffyExtendedEntities {
    media: EntitiesMedia[];
}

export interface MediaVisibilityResults {
    blurred_image_interstitial: BlurredImageInterstitial;
}

export interface BlurredImageInterstitial {
    opacity: number;
    text:    Text;
    title:   Text;
}

export interface Text {
    rtl:      boolean;
    text:     string;
    entities: any[];
}

export interface FluffyQuotedStatusResult {
    result: HilariousResult;
}

export interface HilariousResult {
    __typename:                              FluffyTypename;
    rest_id:                                 string;
    core:                                    StickyCore;
    unmention_data:                          UnmentionData;
    edit_control:                            EditControlInitialClass;
    is_translatable:                         boolean;
    views:                                   Views;
    source:                                  string;
    note_tweet?:                             NoteTweet;
    grok_translated_post_with_availability?: GrokTranslatedPostWithAvailability;
    grok_analysis_button:                    boolean;
    quotedRefResult?:                        QuotedRefResult;
    legacy:                                  IndecentLegacy;
}

export interface StickyCore {
    user_results: FluffyUserResults;
}

export interface FluffyUserResults {
    result: AmbitiousResult;
}

export interface AmbitiousResult {
    __typename:                   PurpleTypename;
    id:                           string;
    rest_id:                      string;
    affiliates_highlighted_label: AffiliatesHighlightedLabel;
    avatar:                       Avatar;
    core:                         FluffyCore;
    dm_permissions:               DmPermissions;
    follow_request_sent:          boolean;
    has_graduated_access:         boolean;
    is_blue_verified:             boolean;
    legacy:                       PurpleLegacy;
    location:                     LocationClass;
    media_permissions:            MediaPermissions;
    parody_commentary_fan_label:  ParodyCommentaryFanLabel;
    profile_image_shape:          ProfileImageShape;
    profile_bio:                  ProfileBio;
    privacy:                      Privacy;
    relationship_perspectives:    PurpleRelationshipPerspectives;
    verification:                 FluffyVerification;
    profile_description_language: FluffyLang;
    super_follow_eligible?:       boolean;
    super_followed_by?:           boolean;
    super_following?:             boolean;
    professional?:                Professional;
}

export interface AffiliatesHighlightedLabel {
    label?: Label;
}

export interface Label {
    badge:                Badge;
    description:          string;
    url:                  LabelURL;
    userLabelDisplayType: string;
    userLabelType:        string;
}

export interface Badge {
    url: string;
}

export interface LabelURL {
    url:     string;
    urlType: string;
}

export interface IndecentLegacy {
    bookmark_count:               number;
    bookmarked:                   boolean;
    created_at:                   string;
    conversation_id_str:          string;
    display_text_range:           number[];
    entities:                     Entit;
    extended_entities?:           PurpleExtendedEntities;
    favorite_count:               number;
    favorited:                    boolean;
    full_text:                    string;
    is_quote_status:              boolean;
    lang:                         FluffyLang;
    possibly_sensitive?:          boolean;
    possibly_sensitive_editable?: boolean;
    quote_count:                  number;
    quoted_status_id_str?:        string;
    quoted_status_permalink?:     QuotedStatusPermalink;
    reply_count:                  number;
    retweet_count:                number;
    retweeted:                    boolean;
    user_id_str:                  string;
    id_str:                       string;
}

export interface QuotedRefResult {
    result: QuotedRefResultResult;
}

export interface QuotedRefResultResult {
    __typename: FluffyTypename;
    rest_id:    string;
}

export interface Tweet {
    rest_id:              string;
    core:                 TweetCore;
    unmention_data:       UnmentionData;
    edit_control:         EditControlInitialClass;
    is_translatable:      boolean;
    views:                Views;
    source:               string;
    grok_analysis_button: boolean;
    legacy:               TweetLegacy;
    grok_annotations:     GrokAnnotations;
}

export interface TweetCore {
    user_results: TentacledUserResults;
}

export interface TentacledUserResults {
    result: CunningResult;
}

export interface CunningResult {
    __typename:                   PurpleTypename;
    id:                           ID;
    rest_id:                      string;
    affiliates_highlighted_label: UnmentionData;
    avatar:                       Avatar;
    core:                         FluffyCore;
    dm_permissions:               DmPermissions;
    follow_request_sent:          boolean;
    has_graduated_access:         boolean;
    is_blue_verified:             boolean;
    legacy:                       PurpleLegacy;
    location:                     LocationClass;
    media_permissions:            MediaPermissions;
    parody_commentary_fan_label:  ParodyCommentaryFanLabel;
    profile_image_shape:          ProfileImageShape;
    professional:                 Professional;
    profile_bio:                  ProfileBio;
    privacy:                      Privacy;
    relationship_perspectives:    FluffyRelationshipPerspectives;
    verification:                 PurpleVerification;
    profile_description_language: PurpleLang;
}

export enum InstructionType {
    TimelineAddEntries = "TimelineAddEntries",
    TimelineAddToModule = "TimelineAddToModule",
    TimelineClearCache = "TimelineClearCache",
    TimelineTerminateTimeline = "TimelineTerminateTimeline",
}

export interface Metadata {
    scribeConfig: ScribeConfig;
}

export interface ScribeConfig {
    page: Page;
}

export enum Page {
    Media = "media",
}
