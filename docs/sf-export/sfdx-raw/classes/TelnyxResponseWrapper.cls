public class TelnyxResponseWrapper {
    public Data data;
    public class Data {
        public String phone_number;
        public String verify_profile_id;
        public Integer timeout_secs;
        public String custom_code;
        public String response_code;
        public String extension;
        public String id;
        public String type;
        public String status;
        public Datetime created_at;
        public Datetime updated_at;
        public String record_type;
        public Integer failed_attempts;
        public String mccmnc;
        public String delivery_status;
    }
    public List<Err> errors;

    public class Err {
        public String code;
        public String title;
        public String detail;
        public Meta meta;
        public Source source;
    }

    public class Meta {
        public String url;
    }

    public class Source {
        public String pointer;
    }
}