public inherited sharing class CitadelSettings {

    private Citadel_Callout_Settings__c source {
        get {
            if (null == source) {
                source = getInstance();
            }
            return source;
        }
        set;
    }

    public String endpoint;

    public CitadelSettings() {
        this.source = getInstance();
        this.endpoint = this.source.Endpoint__c;
    }

    private Citadel_Callout_Settings__c getInstance() {
        return Citadel_Callout_Settings__c.getInstance();
    }
}