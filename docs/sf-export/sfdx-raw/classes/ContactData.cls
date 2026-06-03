/**
 * @Description: Class to retrieve the contact records.
 */
public inherited sharing class ContactData {

    /**
     * @description: Method to query the contact record based on account Id and lead number.
     * @param acctId - Salesforce account record
     * @return List<Contact> - returns the Contact record in a list
     */
    public static List<Contact> queryContact(Account acct) {
        return [SELECT Id, FirstName, LastName, BirthDate, Email, MailingStreet, MailingCity, 
            MailingState, MailingStateCode, MailingPostalCode, MailingCountry, Lead_Number__c, Phone, SSN_Encrypted__c, SSN__c
            FROM Contact WHERE AccountId = :acct.Id LIMIT 1];
    }

    /**
     * @description: Method to query the contact record based on account primary contact.
     * @param acctId - Salesforce account record
     * @return List<Contact> - returns the Contact record in a list
     */
    public static List<Contact> getPrimaryContact(Account acct) {
        return [SELECT Id, FirstName, LastName, BirthDate, Email, MailingStreet, MailingCity, 
            MailingState, MailingStateCode, MailingPostalCode, MailingCountry, Lead_Number__c, Phone, SSN_Encrypted__c, SSN__c 
            FROM Contact WHERE Id = :acct.Primary_Contact__c];
    }

    /**
     * @description: Method to query the contact record based on Map of account id with lead number.
     * @param acctIdSet - Map<String, String> => AccountId, LeadNumber
     * @return List<Contact> - returns the list of accounts
     */
    public static List<Contact> queryContacts(Map<String, String> accIdWithLeadNumber) {
        return [
            SELECT Id, FirstName, LastName, Email, MailingStreet, MailingCity, AccountId,
            MailingState, MailingStateCode, MailingPostalCode, MailingCountry, Lead_Number__c FROM Contact 
            WHERE AccountId IN :accIdWithLeadNumber.keySet() AND Lead_Number__c IN :accIdWithLeadNumber.values()
        ];
    }

    public static List<Contact> queryContactsPhoneNumbers(Id contactId) {
        return [SELECT Id, Phone, MobilePhone FROM Contact WHERE Id = :contactId];
    }

    /**
     * @description: method to query the contact record with the Id and list of contact fields.
     * @param1: Id contactId - Id of the contact record to be queried
     * @param2: Set<String> fields - the collection of the contact fields to be queried
     * @returnType: List<Contact>
    */
    public static List<Contact> queryContact(Id contactId, Set<String> fields) {
        List<String> fieldsList = new List<String>(fields);
        String fieldString = String.join(fieldsList, ', ');
        String query = 'SELECT ' + fieldString + ' FROM Contact WHERE Id = :contactId';
        return Database.query(query);
    }
    
    public static Map<Id, Id> fetchContactToAccountMap(Set<Id> contactIds) {
        Map<Id, Id> result = new Map<Id, Id>();
        if (contactIds == null || contactIds.isEmpty()) return result;
        for (Contact c : [
            SELECT Id, AccountId
            FROM Contact
            WHERE Id IN :contactIds AND AccountId != null
        ]) {
            result.put(c.Id, c.AccountId);
        }
       
        return result;
    }

    public static List<Contact> getContactsByAccountId(Id accountId) {
        return [SELECT Id FROM Contact WHERE AccountId = :accountId];
    }
}