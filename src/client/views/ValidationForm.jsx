import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import ValidationFormComponent from '../components/ValidationForm';
import { useValidation } from '../context/ValidationContext';

const ValidationPageContainer = styled.div`
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
`;

const ValidationFormView = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { submitValidation } = useValidation();
  const navigate = useNavigate();

  const handleSubmit = async (formData) => {
    try {
      setIsSubmitting(true);
      const result = await submitValidation(formData.documentData, {
        regulationId: formData.regulationId,
        levels: formData.validationLevels,
        ...formData.options
      });
      
      // Navigate to results page
      if (result && result.id) {
        navigate(`/results/${result.id}`);
      }
    } catch (error) {
      console.error('Error submitting validation:', error);
      // Error handling is done in the ValidationForm component
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ValidationPageContainer>
      <ValidationFormComponent 
        onSubmit={handleSubmit}
        isLoading={isSubmitting}
      />
    </ValidationPageContainer>
  );
};

export default ValidationFormView; 