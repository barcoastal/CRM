public inherited sharing class RAMSettings {
    private RAMS_Settings__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }
    private RAMS_Settings__c getInstance() {
        return RAMS_Settings__c.getInstance();
    }
    public String endpoint;
    public String apiKey;
    public String affiliateId;
    public String feeSplitGroupId;
    public RAMSettings() {
        this.source = getInstance();
        this.endpoint = this.source.Endpoint__c;
        this.apiKey = this.source.APIKey__c;
        this.affiliateId = this.source.Affiliate_ID__c;
        this.feeSplitGroupId = this.source.Fee_Split_Group_ID__c;
    }
}