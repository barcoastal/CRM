public inherited sharing class SASSettings {

    private SAS_Settings__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }

    public String endpoint;
    public String securityKey;

    public SASSettings() {
        this.source = getInstance();
        this.endpoint = this.source.Endpoint__c;
        this.securityKey = this.source.Security_Key__c;
    }

    private SAS_Settings__c getInstance() {
        return SAS_Settings__c.getInstance();
    }
}