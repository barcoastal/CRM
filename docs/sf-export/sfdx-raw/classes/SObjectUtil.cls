public interface SObjectUtil {
    String getSObjName();
    String getSObjLabel();
    List<SObjectUtilHelper.FieldSetDetails> getFieldsetDetails(String fieldsetName);
}