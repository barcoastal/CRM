public inherited sharing class TwilioConfigSettings {

    private TwilioConfig__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }

    public String accountSId;
    public String authToken;
    public String fromPhone;

    public TwilioConfigSettings() {
        this.source = getInstance();
        this.accountSId = this.source.AccountSid__c;
        this.authToken = this.source.AuthToken__c;
        this.fromPhone = this.source.From_Phone__c;
    }

    private TwilioConfig__c getInstance() {
        return TwilioConfig__c.getInstance();
    }
}