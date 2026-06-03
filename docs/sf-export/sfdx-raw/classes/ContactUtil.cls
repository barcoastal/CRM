public inherited sharing class ContactUtil {
    private static final Schema.DescribeSObjectResult CONTACT_DESCRIBE = Schema.SObjectType.Contact;

    public String getSObjName() {
        return CONTACT_DESCRIBE.getName();
    }

    public String getSObjLabel() {
        return CONTACT_DESCRIBE.getLabel();
    }

    public static Boolean isContactId(Id sObjectId) {
        return ApexUtil.getSObjectName(sObjectId) == CONTACT_DESCRIBE.getName();
    }
}