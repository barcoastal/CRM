public with sharing class SObjectSummary {
  @AuraEnabled
  public String label;
  @AuraEnabled
  public String apiName;
  @AuraEnabled
  public Boolean isClonable; 
  @AuraEnabled
  public String nameField;
  @AuraEnabled
  public Boolean isNamable;
  @AuraEnabled
  public String parentRelationshipField;
  @AuraEnabled
  public List<sFieldSummary> fields;
  @AuraEnabled
  public Boolean isDeletable;
  @AuraEnabled
  public String errorMessage;
  @AuraEnabled
  public Map<String, sObjectSummary> children;

  @AuraEnabled
  public String parentRecordNameFormat;
  @AuraEnabled
  public String childRecordNameFormat;

  public with sharing class sFieldSummary {
    @AuraEnabled
    public String apiName;
    @AuraEnabled
    public String label;
    @AuraEnabled
    public Boolean isClonable;
    @AuraEnabled
    public String errorMessage;

    public sFieldSummary(
      DescribeSObjectResult describe,
      Schema.DescribeFieldResult dfr,
      Set<String> excludedFieldNameSet
    ) {
      this.apiName = dfr.getLocalName();
      this.label = dfr.getLabel();

      List<String> errors = new List<String>();
      if (dfr.getType().name() == 'BASE64') {
        errors.add('BASE64');
      }
      if (dfr.isUnique()) {
        errors.add('IS_UNIQUE');
      }
      if (dfr.getLocalName().endsWith('__pc')) {
        errors.add('IS_PERSON_ACCOUNT');
      }
      if (dfr.isCalculated()) {
        errors.add('IS_CALCULATED');
      }
      if (
        excludedFieldNameSet != null &&
        excludedFieldNameSet.contains(dfr.getLocalName()) &&
        (dfr.isNillable() || dfr.isDefaultedOnCreate())
      ) {
        errors.add('IS_EXCLUDED');
      }

      this.errorMessage = String.join(errors, ',');
      this.isClonable = errors.size() == 0;
    }
  }
}