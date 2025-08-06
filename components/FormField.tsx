const FormField = ({ id, label, type = "text", value, onChange, placeholder, as = "input", options = []}: FormFieldProps) => {
    return (
        <div className="form-field">
            <label htmlFor={id} className="dark:text-white">{label}</label>

            { as === 'textarea' ?
                (
                    <textarea
                        id={id}
                        name={id}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        className="dark:text-white"
                    />
                ) : as === 'select' ? (
                        <select
                            id={id}
                            name={id}
                            value={value}
                            onChange={onChange}
                        >
                            {options.map(({ label, value }) => (
                                <option key={label} value={value} className="dark:text-white">{label}</option>
                            ))}
                        </select>
                ): (
                    <input
                        id={id}
                        name={id}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                    />
                )}
        </div>
    )
}
export default FormField
